// Architecture test with ArchUnit: the boundary rules between the modules.
// Usage: java morada.Architecture before|after   (exits with 1 on a violation)
package morada;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import java.util.List;

public class Architecture {

    public static List<ArchRule> rules(String version) {
        String modules = "morada." + version + ".modules.";
        return List.of(
            noClasses()
                .that()
                .resideInAPackage(modules + "bookings..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage(modules + "billing.internal..")
                .as("Bookings only uses the public API of Billing"),
            noClasses()
                .that()
                .resideInAPackage(modules + "billing..")
                .should()
                .dependOnClassesThat()
                .resideInAPackage(modules + "bookings..")
                .as("Billing does not depend on Bookings")
        );
    }

    public static void main(String[] args) {
        String version = args[0];
        var classes = new ClassFileImporter().importPackages("morada." + version);
        boolean violated = false;
        for (ArchRule rule : rules(version)) {
            var result = rule.evaluate(classes);
            if (result.hasViolation()) {
                violated = true;
                System.out.println(result.getFailureReport());
            } else {
                System.out.println("OK: " + rule.getDescription());
            }
        }
        System.exit(violated ? 1 : 0);
    }
}
