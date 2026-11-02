// The core (microkernel): it knows how to issue the batch of charges, but knows no
// bank. Each bank is a plugin that fulfills the BankPlugin contract and is discovered
// in a folder of source code, compiled and loaded at run time.
package morada.plugins;

import java.net.URL;
import java.net.URLClassLoader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import javax.tools.ToolProvider;
import morada.plugins.BankPlugin.Charge;

public class Core {

    private final Map<String, BankPlugin> plugins = new TreeMap<>();

    public static String dollars(long cents) {
        String whole = String.format(Locale.US, "%,d", cents / 100);
        return "$" + whole + "." + String.format("%02d", cents % 100);
    }

    public void install(Object plugin) {
        if (!(plugin instanceof BankPlugin p)) {
            throw new IllegalArgumentException("plugin does not fulfill the contract");
        }
        plugins.put(p.name(), p);
    }

    // Discovery: each file in the folder is a plugin; no fixed list in the code
    public void load(Path folder) throws Exception {
        List<String> sources = new ArrayList<>();
        try (var files = Files.list(folder)) {
            files
                .filter(f -> f.toString().endsWith(".java"))
                .sorted()
                .forEach(f -> sources.add(f.toString()));
        }
        if (sources.isEmpty()) return;
        Path classes = Files.createTempDirectory("plugins");
        String classpath = System.getProperty("java.class.path");
        List<String> options = new ArrayList<>(
            List.of("-d", classes.toString(), "-cp", classpath)
        );
        options.addAll(sources);
        int code = ToolProvider.getSystemJavaCompiler().run(
            null,
            null,
            null,
            options.toArray(String[]::new)
        );
        if (code != 0) throw new IllegalStateException("plugin does not compile");
        var loader = new URLClassLoader(
            new URL[] { classes.toUri().toURL() },
            Core.class.getClassLoader()
        );
        for (String source : sources) {
            String className = Path.of(source)
                .getFileName()
                .toString()
                .replace(".java", "");
            install(loader.loadClass(className).getDeclaredConstructor().newInstance());
        }
    }

    public List<String> names() {
        return List.copyOf(plugins.keySet());
    }

    // A missing or faulty plugin does not bring down the whole batch
    public String issue(Charge c) {
        BankPlugin plugin = plugins.get(c.bank());
        String result;
        if (plugin == null) {
            result = "no plugin for bank " + c.bank();
        } else {
            try {
                result = plugin.register(c);
            } catch (RuntimeException error) {
                result = "plugin " + plugin.name() + " failed: " + error.getMessage();
            }
        }
        String amount = dollars(c.amountCents());
        return c.unit() + ";" + amount + ";" + c.bank() + ";" + result;
    }
}
