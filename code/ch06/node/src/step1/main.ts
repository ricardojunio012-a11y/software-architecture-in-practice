// Original bookings module, written in a hurry for the first owners' meeting.
// DO NOT TOUCH without talking to George!!! (calculates weekend)
import fs from "node:fs";

var approved: any[] = [];
var log: string[] = [];

var smtp = {
  send(to: string, txt: string) {
    log.push("to " + to + ": " + txt);
  },
};

export function processBookings(fn: string, dir: string) {
  var d = JSON.parse(fs.readFileSync(fn, "utf8"));
  var out: string[] = [];
  var td = new Date();
  for (var r of d.requests) {
    var u = d.units.find((x: any) => x.id == r.unit);
    var s = d.spaces.find((x: any) => x.id == r.space);
    var ok = true;
    var msg = "";
    if (u.inArrears) {
      ok = false;
      msg = "arrears";
    } else {
      var dt = new Date(r.date + "T00:00:00Z");
      var h = Date.UTC(td.getUTCFullYear(), td.getUTCMonth(), td.getUTCDate());
      var n = Math.round((dt.getTime() - h) / 86400000);
      if (n < 2) {
        ok = false;
        msg = "short notice";
      } else {
        for (var a of approved) {
          if (a.space == r.space && a.date == r.date) {
            ok = false;
            msg = "conflict";
          }
        }
      }
    }
    if (ok) {
      // calculates the amount
      var v = s.fee;
      var dt2 = new Date(r.date + "T00:00:00Z");
      if (dt2.getUTCDay() == 6) v = v + (v * 20) / 100; // weekend
      if (r.guests > 50) v = v + 5000;
      approved.push(r);
      var vv = Math.floor(v / 100) + "." + String(v % 100).padStart(2, "0");
      out.push(`${r.id};${r.unit};${r.space};${r.date};approved;${vv}`);
      smtp.send(u.email, "Booking " + r.id + " confirmed. Amount: $" + vv);
    } else {
      out.push(`${r.id};${r.unit};${r.space};${r.date};declined;${msg}`);
      smtp.send(u.email, "Booking " + r.id + " declined (" + msg + ")");
    }
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + "/bookings.txt", out.join("\n") + "\n");
  fs.writeFileSync(dir + "/emails.txt", log.join("\n") + "\n");
}

processBookings(process.argv[2], process.argv[3]);
