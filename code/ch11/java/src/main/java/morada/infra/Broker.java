// The broker (RabbitMQ): a fanout exchange delivers each event to the Bookings and
// Communications queues. Each module has its own queue and consumes at its own pace.
package morada.infra;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import java.util.List;
import java.util.function.Consumer;
import morada.Events.PaymentConfirmed;

public class Broker {

    public static final List<String> QUEUES = List.of(
        "bookings.payments",
        "communications.payments"
    );
    private static final ObjectMapper JSON = new ObjectMapper();

    public record Connected(Connection connection, Channel channel) {}

    public static Connected connect() throws Exception {
        var factory = new ConnectionFactory();
        factory.setUri(System.getenv("BROKER_URL"));
        Connection connection = factory.newConnection();
        Channel channel = connection.createChannel();
        channel.confirmSelect();
        channel.exchangeDeclare("payments", "fanout", true);
        for (String queue : QUEUES) {
            channel.queueDeclare(queue, true, false, false, null);
            channel.queuePurge(queue);
            channel.queueBind(queue, "payments", "");
        }
        return new Connected(connection, channel);
    }

    // Counts as published only after the broker confirms receipt
    public static void publish(Channel channel, PaymentConfirmed e) throws Exception {
        var properties = new AMQP.BasicProperties.Builder()
            .deliveryMode(2)
            .messageId(e.event())
            .build();
        channel.basicPublish("payments", "", properties, JSON.writeValueAsBytes(e));
        channel.waitForConfirmsOrDie(5000);
    }

    // Consumes the queue until it is empty; the acknowledgment (ack) comes after handling
    public static void consumeAll(
        Channel channel,
        String queue,
        Consumer<PaymentConfirmed> handle
    ) throws Exception {
        for (;;) {
            var response = channel.basicGet(queue, false);
            if (response == null) return;
            handle.accept(JSON.readValue(response.getBody(), PaymentConfirmed.class));
            channel.basicAck(response.getEnvelope().getDeliveryTag(), false);
        }
    }
}
