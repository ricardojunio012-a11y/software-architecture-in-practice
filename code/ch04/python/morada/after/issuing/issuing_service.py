# Controller (GRASP): coordinates the calculation and the registration without doing
# either. Depends on abstractions passed to the constructor (dependency injection).
from morada.after.billing.calculator import ChargeCalculator
from morada.after.issuing.gateway import Deadlines, PaymentGateway


class IssuingService:
    def __init__(
        self,
        calculator: ChargeCalculator,
        gateway: PaymentGateway,
        deadlines: Deadlines,
    ):
        self._calculator = calculator
        self._gateway = gateway
        self._deadlines = deadlines

    def issue(self, units: list[dict]):
        charges = [self._calculator.calculate(u) for u in units]
        registrations = [self._gateway.register(c, self._deadlines) for c in charges]
        return charges, registrations
