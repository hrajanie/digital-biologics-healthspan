import { describe, expect, it } from 'vitest';
import type { Family } from '../src/core/types';
import { buildCost } from '../src/world/content';
import { committedDeploymentLevels, deployedAssetBasis, deploymentCost, quoteDeployment } from '../src/world/deployment';

const families: Family[] = ['diagnostics', 'clinic', 'manufacturing', 'evidence', 'followup', 'network'];
const levels = (network = 4): Record<Family, number> => ({ diagnostics: 1, clinic: 1, manufacturing: 1, evidence: 1, followup: 1, network });
const USD = (dollars: number) => dollars * 100;

describe('deployment quotes', () => {
  it('preserves every early hub tier price through the first 4,000 sites', () => {
    for (let network = 0; network <= 4; network++) {
      for (const family of families) {
        for (let level = 0; level < 8; level++) {
          if (family === 'network' && level >= 4) continue;
          const before = { ...levels(network), [family]: level };
          expect(deploymentCost(before, family)).toBe(buildCost(family, level));
        }
      }
    }
  });

  it('charges only sites beyond 4,000 for current service upgrades', () => {
    const medium = quoteDeployment(levels(5), 'clinic');
    expect(medium.billableSites).toBe(21_000);
    expect(medium.siteActivationCost).toBe(0);
    expect(medium.upgradeInstallationCost).toBe(USD(525_000_000));
    const late = quoteDeployment(levels(8), 'followup');
    expect(late.billableSites).toBe(1_196_000);
    expect(late.deploymentCost).toBe(USD(17_940_000_000));
    expect(late.totalCost).toBe(late.baseCost + late.deploymentCost);
    expect(late.detail).toContain('1,196,000 sites');
  });

  it('installs already upgraded standards in newly activated sites', () => {
    const before = { ...levels(4), clinic: 3, followup: 2 };
    const quote = quoteDeployment(before, 'network', 6);
    expect(quote.billableSites).toBe(156_000);
    expect(quote.siteActivationCost).toBe(USD(156_000_000));
    expect(quote.upgradeInstallationCost).toBe(USD(10_140_000_000));
    expect(quote.deploymentCost).toBe(USD(10_296_000_000));
    expect(quote.baseCost).toBe(buildCost('network', 4) + buildCost('network', 5));
    expect(quote.detail).toContain('existing or already funded service upgrades');
  });

  it('has no discount from bundling a personal network tranche', () => {
    const before = { ...levels(4), clinic: 4, followup: 3 };
    const together = quoteDeployment(before, 'network', 6);
    const first = quoteDeployment(before, 'network', 5);
    const second = quoteDeployment({ ...before, network: 5 }, 'network', 6);
    expect(together.totalCost).toBe(first.totalCost + second.totalCost);
    expect(together.deploymentCost).toBe(first.deploymentCost + second.deploymentCost);
  });

  it('preserves path-independent fees for expansion before or after service upgrades', () => {
    const start = levels(4);
    const routes: [Family, number][][] = [
      [['network', 8], ['clinic', 4], ['followup', 3]],
      [['clinic', 4], ['followup', 3], ['network', 8]],
      [['network', 6], ['clinic', 2], ['followup', 2], ['network', 7], ['clinic', 4], ['network', 8], ['followup', 3]],
    ];
    const costs = routes.map(route => {
      let current = { ...start }, deployment = 0, total = 0;
      for (const [family, target] of route) {
        const quote = quoteDeployment(current, family, target);
        deployment += quote.deploymentCost;
        total += quote.totalCost;
        current[family] = target;
      }
      expect(total).toBe(deployedAssetBasis(current) - deployedAssetBasis(start));
      return deployment;
    });
    expect(costs).toEqual([USD(126_776_000_000), USD(126_776_000_000), USD(126_776_000_000)]);
  });

  it('reserves overlapping funded projects so same-year action order cannot skip adoption costs', () => {
    const installed = levels(4);
    const networkFirst = quoteDeployment(installed, 'network', 6);
    const afterNetworkReservation = committedDeploymentLevels(installed, [{ family: 'network', targetLevel: 6 }]);
    const clinicSecond = quoteDeployment(afterNetworkReservation, 'clinic', 2);
    const clinicFirst = quoteDeployment(installed, 'clinic', 2);
    const afterClinicReservation = committedDeploymentLevels(installed, [{ family: 'clinic', targetLevel: 2 }]);
    const networkSecond = quoteDeployment(afterClinicReservation, 'network', 6);
    expect(networkFirst.totalCost + clinicSecond.totalCost).toBe(clinicFirst.totalCost + networkSecond.totalCost);
    expect(networkFirst.deploymentCost + clinicSecond.deploymentCost).toBe(USD(4_056_000_000));
    expect(installed).toEqual(levels(4));
  });

  it('keeps replacement basis distinct from the next commitment and includes bundled base standards', () => {
    const unopened = Object.fromEntries(families.map(f => [f, 0])) as Record<Family, number>;
    const reserved = committedDeploymentLevels(unopened, [{ family: 'network', targetLevel: 2 }]);
    expect(reserved).toEqual(levels(2));
    expect(deployedAssetBasis(unopened)).toBe(0);
    expect(deployedAssetBasis(reserved)).toBe(families.reduce((sum, f) => sum + buildCost(f, 0), 0) + buildCost('network', 1));
    const a = levels(8), b = { ...a, clinic: 2 };
    expect(deployedAssetBasis(b) - deployedAssetBasis(a)).toBe(deploymentCost(a, 'clinic'));
    expect(committedDeploymentLevels(a, [{ family: 'clinic' }]).clinic).toBe(2);
  });

  it('returns safe integer cents without mutating frozen inputs', () => {
    const maximum = Object.freeze(Object.fromEntries(families.map(f => [f, 8])) as Record<Family, number>);
    expect(Number.isSafeInteger(deployedAssetBasis(maximum))).toBe(true);
    expect(deployedAssetBasis(maximum)).toBeGreaterThan(USD(629_096_000_000));
    const before = Object.freeze({ ...maximum, clinic: 7 });
    const quote = quoteDeployment(before, 'clinic');
    for (const key of ['baseCost', 'siteActivationCost', 'upgradeInstallationCost', 'deploymentCost', 'totalCost'] as const) {
      expect(Number.isSafeInteger(quote[key])).toBe(true);
    }
    expect(before.clinic).toBe(7);
  });

  it('rejects invalid levels, downgrade requests and saturated builds', () => {
    for (const value of [-1, .5, 9, NaN, Infinity]) {
      expect(() => deployedAssetBasis({ ...levels(), clinic: value })).toThrow(RangeError);
      expect(() => quoteDeployment(levels(), 'clinic', value)).toThrow(RangeError);
    }
    expect(() => quoteDeployment(levels(), 'clinic', 1)).toThrow(RangeError);
    expect(() => quoteDeployment(levels(8), 'network')).toThrow(RangeError);
    expect(() => committedDeploymentLevels(levels(), [{ family: 'network', targetLevel: 9 }])).toThrow(RangeError);
  });
});
