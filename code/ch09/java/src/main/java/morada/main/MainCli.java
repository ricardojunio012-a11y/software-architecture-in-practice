// Usage: java morada.main.MainCli <command> [arguments]   (repository in PostgreSQL)
//        java morada.main.MainCli prepare-db              (drops and recreates the table)
// Each run is a new process: the state stays in the database between runs.
package morada.main;

import morada.adapters.inbound.Cli;

public class MainCli {

    public static void main(String[] args) throws Exception {
        boolean prepare = args.length > 0 && args[0].equals("prepare-db");
        var assembled = Assemble.assemble("postgres", prepare);
        var result = prepare
            ? new Cli.Result("database ready", 0)
            : Cli.execute(assembled.service(), args);
        System.out.println(result.text());
        System.exit(result.code());
    }
}
