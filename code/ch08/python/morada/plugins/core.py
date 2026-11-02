# The core (microkernel): it knows how to issue the batch of charges, but knows no
# bank. Each bank is a plugin that fulfills the contract below, discovered in a folder.
import importlib.util
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class Charge:
    unit: str
    amount_cents: int
    bank: str


# The contract: everything the core knows about a plugin
class BankPlugin(Protocol):
    name: str

    def register(self, charge: Charge) -> str: ...


def dollars(cents: int) -> str:
    return f"${cents // 100:,}.{cents % 100:02d}"


class Core:
    def __init__(self):
        self._plugins: dict[str, BankPlugin] = {}

    def install(self, plugin) -> None:
        name = getattr(plugin, "name", None)
        if not isinstance(name, str) or not callable(getattr(plugin, "register", None)):
            raise TypeError("plugin does not fulfill the contract")
        self._plugins[name] = plugin

    # Discovery: each file in the folder is a plugin; no fixed list in the code
    def load(self, folder: str) -> None:
        for file in sorted(Path(folder).glob("*.py")):
            spec = importlib.util.spec_from_file_location(file.stem, file)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            self.install(module.plugin)

    def names(self) -> list[str]:
        return sorted(self._plugins)

    # A missing or faulty plugin does not bring down the whole batch
    def issue(self, c: Charge) -> str:
        plugin = self._plugins.get(c.bank)
        if plugin is None:
            result = f"no plugin for bank {c.bank}"
        else:
            try:
                result = plugin.register(c)
            except Exception as error:
                result = f"plugin {plugin.name} failed: {error}"
        return f"{c.unit};{dollars(c.amount_cents)};{c.bank};{result}"
