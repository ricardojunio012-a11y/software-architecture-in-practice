<?php
// Step 1: Morada's first code. Everything in one function, the way code is born.
namespace Morada\Step1;

function generateBilling(
    string $input,
    string $output,
    ?\DateTimeImmutable $today = null,
) {
    $today ??= new \DateTimeImmutable('today', new \DateTimeZone('UTC'));
    $data = json_decode(file_get_contents($input), true);
    $year = $today->format('Y');
    $month = $today->format('m');
    $period = "$month/$year";
    $dueDate = "$month/10/$year";
    $name = $data['community']['name'];
    $dollars = fn(int $c) => number_format(intdiv($c, 100), 0, '.', ',') .
        '.' .
        str_pad((string) ($c % 100), 2, '0', STR_PAD_LEFT);

    $lines = ["# Charges $period - $name - due $dueDate"];
    $lines[] = 'unit;resident;dues;reserve;arrears;late_fee;interest;total;payment';
    $emails = '';

    foreach ($data['units'] as $u) {
        // dues by ownership share, rounded to the nearest cent
        $expenses = $data['community']['monthlyExpensesCents'];
        $dues = intdiv($expenses * $u['shareMillionths'] + 500000, 1000000);
        $reserve = intdiv($dues * 10 + 50, 100); // reserve fund: 10%
        $arrears = 0;
        $lateFee = 0;
        $interest = 0;
        if ($u['pastDue'] !== null) {
            $arrears = $u['pastDue']['amountCents'];
            $lateFee = intdiv($arrears * 2 + 50, 100); // 2% late fee
            $due = new \DateTimeImmutable($u['pastDue']['dueDate']);
            $days = $due->diff($today)->days;
            $interest = intdiv($arrears * $days + 1500, 3000); // 1% a month, prorated
        }
        $total = $dues + $reserve + $arrears + $lateFee + $interest;
        $code = "INV-{$data['community']['id']}-$year$month-{$u['id']}-$total";

        $values = array_map($dollars, [
            $dues,
            $reserve,
            $arrears,
            $lateFee,
            $interest,
            $total,
        ]);
        $lines[] = implode(';', [$u['id'], $u['resident']['name'], ...$values, $code]);

        $emails .= "To: {$u['resident']['email']}\n";
        $emails .= "Subject: Monthly dues $period - $name";
        $emails .= " - Unit {$u['id']}\n\n";
        $emails .= "Hello, {$u['resident']['name']}.\n\n";
        $emails .= "The monthly dues for $period for unit {$u['id']} ";
        $emails .= "are now available.\n";
        $emails .= 'Amount: $' . $dollars($total) . "\n";
        $emails .= "Due date: $dueDate\n";
        if ($arrears > 0) {
            $emails .= 'Includes a past-due balance of $' . $dollars($arrears);
            $emails .= ', with a late fee of $' . $dollars($lateFee);
            $emails .= ' and interest of $' . $dollars($interest) . ".\n";
        }
        $emails .= "Invoice: $code\n\n";
        $emails .= "$name Management\n----\n";
    }

    if (!is_dir($output)) {
        mkdir($output, 0777, true);
    }
    file_put_contents("$output/charges.txt", implode("\n", $lines) . "\n");
    file_put_contents("$output/emails.txt", $emails);
}
