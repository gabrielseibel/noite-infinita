import { ENERGY } from '../data/balance';

/** Energia entre 0 e max, regenerando continuamente. */
export class EnergySystem {
  value: number;
  readonly max: number;
  /** Multiplicador permanente (melhorias). */
  regenBonus: number;
  /** Multiplicador temporário (fase final). */
  phaseMult = 1;
  spent = 0;

  constructor(start = ENERGY.start, max = ENERGY.max, regenBonus = 0) {
    this.value = Math.min(start, max);
    this.max = max;
    this.regenBonus = regenBonus;
  }

  get ratePerSecond(): number {
    return ((1 / ENERGY.secondsPerPoint) * (1 + this.regenBonus)) * this.phaseMult;
  }

  update(dt: number) {
    this.value = Math.min(this.max, this.value + this.ratePerSecond * dt);
  }

  canAfford(cost: number) {
    return this.value + 1e-6 >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.value = Math.max(0, this.value - cost);
    this.spent += cost;
    return true;
  }

  gain(amount: number) {
    this.value = Math.min(this.max, this.value + amount);
  }
}
