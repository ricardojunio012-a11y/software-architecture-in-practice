<?php
// Orchestrates the monthly run: calculates, creates the payment, records and notifies.
namespace Morada\Step4;

require_once __DIR__ . '/Money.php';
require_once __DIR__ . '/BillingPeriod.php';
require_once __DIR__ . '/Calculation.php';
require_once __DIR__ . '/Payment.php';
require_once __DIR__ . '/Notification.php';
require_once __DIR__ . '/ChargeReport.php';
require_once __DIR__ . '/Card.php';
require_once __DIR__ . '/Sms.php';

/**
 * @param array<string, PaymentMethod> $paymentMethods
 * @param array<string, Notifier> $notifiers
 */
function generateBilling(
    array $data,
    \DateTimeImmutable $today,
    array $paymentMethods,
    array $notifiers,
): ChargeReport {
    $community = $data['community'];
    $period = BillingPeriod::of($today);
    $report = new ChargeReport($community['name'], $period);
    foreach ($data['units'] as $unit) {
        $payment = $paymentMethods[$unit['paymentMethod']];
        $notifier = $notifiers[$unit['resident']['channel']];
        $charge = Calculation::calculateCharge(
            $community['monthlyExpensesCents'],
            $unit,
            $today,
        );
        $code = $payment->generateCode($community['id'], $period, $charge);
        $report->add($charge, $code);
        $notifier->notify(
            new Notice($community['name'], $period, $charge, $payment->name(), $code),
        );
    }
    return $report;
}
