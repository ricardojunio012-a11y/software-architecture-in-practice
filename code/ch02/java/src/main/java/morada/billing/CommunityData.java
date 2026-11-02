// The input file: the community and its units.
package morada.billing;

import java.util.List;

public record CommunityData(Community community, List<Unit> units) {
    public record Community(String id, String name, long monthlyExpensesCents) {}
}
