// Step 2: the original code after the three change requests
// (early-payment discount, card payments and text messages), done the most direct way.
import fs from "node:fs";
import path from "node:path";

export function generateBilling(input: string, output: string, today = new Date()) {
  const data = JSON.parse(fs.readFileSync(input, "utf8")); // ① reads the file
  const year = today.getUTCFullYear(); // ② checks the clock
  const month = String(today.getUTCMonth() + 1).padStart(2, "0");
  const period = `${month}/${year}`;
  const dueDate = `${month}/10/${year}`;
  const discountDeadline = `${month}/05/${year}`;
  const name = data.community.name;
  const dollars = (c: number) =>
    Math.floor(c / 100).toLocaleString("en-US") + // ④ formats in dollars
    "." +
    String(c % 100).padStart(2, "0");

  const lines = [`# Charges ${period} - ${name} - due ${dueDate}`];
  lines.push(
    "unit;resident;dues;reserve;arrears;late_fee;interest;total;total_by_5th;payment",
  );
  let emails = "";
  let sms = "";

  for (const u of data.units) {
    // ③ dues by ownership share, rounded to the nearest cent
    const expenses = data.community.monthlyExpensesCents;
    const dues = Math.floor((expenses * u.shareMillionths + 500000) / 1000000);
    const reserve = Math.floor((dues * 10 + 50) / 100); // reserve fund: 10%
    let arrears = 0;
    let lateFee = 0;
    let interest = 0;
    if (u.pastDue) {
      arrears = u.pastDue.amountCents;
      lateFee = Math.floor((arrears * 2 + 50) / 100); // 2% late fee
      const due = Date.parse(u.pastDue.dueDate + "T00:00:00Z");
      const days = Math.round((today.getTime() - due) / 86400000);
      interest = Math.floor((arrears * days + 1500) / 3000); // 1% a month, prorated
    }
    const total = dues + reserve + arrears + lateFee + interest;
    // 5% off the dues for paying by the 5th with no past-due balance
    let totalBy5th = 0;
    if (arrears === 0) {
      totalBy5th = total - Math.floor((dues * 5 + 50) / 100);
    }
    let code = "";
    if (u.paymentMethod === "card") {
      code = `CARD-${data.community.id}-${year}${month}-${u.id}-${total}`;
    } else {
      code = `INV-${data.community.id}-${year}${month}-${u.id}-${total}`;
    }

    const values = [dues, reserve, arrears, lateFee, interest, total].map(dollars);
    const discounted = totalBy5th > 0 ? dollars(totalBy5th) : "-";
    lines.push([u.id, u.resident.name, ...values, discounted, code].join(";"));

    if (u.resident.channel === "sms") {
      sms += `To: ${u.resident.phone}\n`;
      sms += `${name}: dues ${period} for unit ${u.id}: `;
      sms += `$${dollars(total)}, due ${dueDate}.`;
      if (totalBy5th > 0) {
        sms += ` By ${discountDeadline}: $${dollars(totalBy5th)}.`;
      }
      const method = u.paymentMethod === "card" ? "Card payment" : "Invoice";
      sms += ` ${method}: ${code}\n----\n`;
    } else {
      emails += `To: ${u.resident.email}\n`;
      emails += `Subject: Monthly dues ${period} - ${name}`;
      emails += ` - Unit ${u.id}\n\n`;
      emails += `Hello, ${u.resident.name}.\n\n`;
      emails += `The monthly dues for ${period} for unit ${u.id} `;
      emails += "are now available.\n";
      emails += `Amount: $${dollars(total)}\n`;
      emails += `Due date: ${dueDate}\n`;
      if (totalBy5th > 0) {
        emails += `Pay by ${discountDeadline} and the amount drops to `;
        emails += `$${dollars(totalBy5th)}.\n`;
      }
      if (arrears > 0) {
        emails += `Includes a past-due balance of $${dollars(arrears)}, `;
        emails += `with a late fee of $${dollars(lateFee)} and interest of `;
        emails += `$${dollars(interest)}.\n`;
      }
      if (u.paymentMethod === "card") {
        emails += `Card payment: ${code}\n\n`;
      } else {
        emails += `Invoice: ${code}\n\n`;
      }
      emails += `${name} Management\n----\n`;
    }
  }

  fs.mkdirSync(output, { recursive: true }); // ⑦ writes the files
  fs.writeFileSync(path.join(output, "charges.txt"), lines.join("\n") + "\n");
  fs.writeFileSync(path.join(output, "emails.txt"), emails);
  fs.writeFileSync(path.join(output, "sms.txt"), sms);
}
