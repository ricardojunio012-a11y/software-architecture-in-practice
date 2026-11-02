<?php
// The core (microkernel): it knows how to issue the batch of charges, but knows no
// bank. Each bank is a plugin that fulfills the contract below, discovered in a folder.
namespace Morada\Plugins;

final readonly class Charge
{
    public function __construct(
        public string $unit,
        public int $amountCents,
        public string $bank,
    ) {}
}

// The contract: everything the core knows about a plugin
interface BankPlugin
{
    public function name(): string;

    public function register(Charge $charge): string;
}

function dollars(int $cents): string
{
    return '$' . number_format($cents / 100, 2, '.', ',');
}

final class Core
{
    /** @var array<string, BankPlugin> */
    private array $plugins = [];

    public function install(mixed $plugin): void
    {
        if (!($plugin instanceof BankPlugin)) {
            throw new \InvalidArgumentException('plugin does not fulfill the contract');
        }
        $this->plugins[$plugin->name()] = $plugin;
    }

    // Discovery: each file in the folder is a plugin; no fixed list in the code
    public function load(string $folder): void
    {
        $files = glob("$folder/*.php");
        sort($files);
        foreach ($files as $file) {
            $this->install(require $file);
        }
    }

    /** @return string[] */
    public function names(): array
    {
        $names = array_keys($this->plugins);
        sort($names);
        return $names;
    }

    // A missing or faulty plugin does not bring down the whole batch
    public function issue(Charge $c): string
    {
        $plugin = $this->plugins[$c->bank] ?? null;
        if ($plugin === null) {
            $result = "no plugin for bank {$c->bank}";
        } else {
            try {
                $result = $plugin->register($c);
            } catch (\Throwable $error) {
                $result = "plugin {$plugin->name()} failed: {$error->getMessage()}";
            }
        }
        return "{$c->unit};" . dollars($c->amountCents) . ";{$c->bank};$result";
    }
}
