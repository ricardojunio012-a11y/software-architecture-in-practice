// Global configuration: any module reads and changes it (common coupling).
package morada.before.config;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;

public final class Config {

    public static int reservePercent = 10;
    public static int lateFeePercent = 2;
    public static LocalDate today = LocalDate.now();
    public static JsonNode data; // the whole community, filled in by main

    private Config() {}
}
