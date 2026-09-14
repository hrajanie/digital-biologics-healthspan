import type { Family, Money } from '../core/types';
import { buildCost, siteCount } from './content';

/** Fictional balancing assumptions in integer USD cents, not market estimates. */
export const DEPLOYMENT_FREE_SITES = 4_000;
export const SITE_ACTIVATION_COST: Money = 100_000;
export const UPGRADE_INSTALLATION_COST = Object.freeze({
  diagnostics: 1_000_000,
  clinic: 2_500_000,
  manufacturing: 2_000_000,
  evidence: 500_000,
  followup: 1_500_000,
} satisfies Record<Exclude<Family, 'network'>, Money>);

const SERVICES = Object.keys(UPGRADE_INSTALLATION_COST) as Exclude<Family, 'network'>[];
const FAMILIES: Family[] = [...SERVICES, 'network'];
export type DeploymentLevels = Readonly<Record<Family, number>>;

export interface DeploymentQuote {
  family: Family;
  currentLevel: number;
  targetLevel: number;
  /** Sites charged for this service upgrade, or newly charged sites for expansion. */
  billableSites: number;
  baseCost: Money;
  siteActivationCost: Money;
  /** Includes adoption of already ordered service upgrades by new network sites. */
  upgradeInstallationCost: Money;
  deploymentCost: Money;
  totalCost: Money;
  detail: string;
}

function validateLevels(levels: DeploymentLevels): void {
  for (const family of FAMILIES) {
    if (!Number.isInteger(levels[family]) || levels[family] < 0 || levels[family] > 8) {
      throw new RangeError(`${family} level must be an integer from 0 to 8.`);
    }
  }
}

function checkedMoney(value: number): Money {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('Deployment cost must be nonnegative safe integer cents.');
  return value;
}

function billableSites(levels: DeploymentLevels): number {
  return Math.max(0, siteCount(levels.network) - DEPLOYMENT_FREE_SITES);
}

function installedUpgradeRate(levels: DeploymentLevels): Money {
  return SERVICES.reduce((total, family) => total + Math.max(0, levels[family] - 1) * UPGRADE_INSTALLATION_COST[family], 0);
}

function baseAssetBasis(levels: DeploymentLevels): Money {
  let total = 0;
  for (const family of FAMILIES) for (let level = 0; level < levels[family]; level++) total += buildCost(family, level);
  return checkedMoney(total);
}

/**
 * Total modeled replacement basis of installed assets, including one deployment
 * charge for each site's current standards. This is not cash, current spending,
 * or an instruction to charge the deployment fee again. Forecasts may use this
 * basis for their separately disclosed replacement assumption.
 */
export function deployedAssetBasis(levels: DeploymentLevels): Money {
  validateLevels(levels);
  return checkedMoney(baseAssetBasis(levels) + billableSites(levels) * (SITE_ACTIVATION_COST + installedUpgradeRate(levels)));
}

/**
 * Pricing-only levels after already funded build commitments. Pass projects for
 * ONE region, filtered to kind === 'build'. Pending standards are reserved in
 * the next quote so overlapping network/service projects cannot avoid adoption
 * costs. Do not use these levels for care, operating costs, or installed assets.
 */
export function committedDeploymentLevels(
  levels: DeploymentLevels,
  projects: readonly { family?: Family; targetLevel?: number }[],
): Record<Family, number> {
  validateLevels(levels);
  const result = { ...levels };
  for (const project of projects) {
    const family = project.family;
    if (!family || !FAMILIES.includes(family)) throw new RangeError('A deployment commitment must identify its infrastructure family.');
    const target = project.targetLevel ?? levels[family] + 1;
    if (!Number.isInteger(target) || target < 0 || target > 8) throw new RangeError('Committed target level must be an integer from 0 to 8.');
    result[family] = Math.max(result[family], target);
  }
  // Network commissioning includes the first standard of every service.
  if (result.network > 0) for (const family of SERVICES) result[family] = Math.max(1, result[family]);
  return result;
}

const dollars = (cents: Money): string => `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * Quote a commitment without mutating levels. Early hub costs are unchanged.
 * Network expansion pays to install the service standards at newly charged
 * sites; a service upgrade pays only its incremental standard at existing sites.
 * Therefore deployment charges are independent of action order and batching.
 * Use committedDeploymentLevels first when the region has pending builds.
 */
export function quoteDeployment(levels: DeploymentLevels, family: Family, targetLevel = levels[family] + 1): DeploymentQuote {
  validateLevels(levels);
  if (!FAMILIES.includes(family)) throw new RangeError('Unknown infrastructure family.');
  const currentLevel = levels[family];
  if (!Number.isInteger(targetLevel) || targetLevel <= currentLevel || targetLevel > 8) {
    throw new RangeError('Deployment target must be an integer above the current level and at most 8.');
  }
  let baseCost = 0;
  for (let level = currentLevel; level < targetLevel; level++) baseCost += buildCost(family, level);

  const sites = family === 'network'
    ? billableSites({ ...levels, network: targetLevel }) - billableSites(levels)
    : billableSites(levels);
  const siteActivationCost = family === 'network' ? sites * SITE_ACTIVATION_COST : 0;
  const upgradeInstallationCost = family === 'network'
    ? sites * installedUpgradeRate(levels)
    : sites * (Math.max(0, targetLevel - 1) - Math.max(0, currentLevel - 1)) * UPGRADE_INSTALLATION_COST[family];
  const deploymentCost = checkedMoney(siteActivationCost + upgradeInstallationCost);
  const totalCost = checkedMoney(baseCost + deploymentCost);
  const detail = sites === 0
    ? `${dollars(baseCost)} base project. The first ${DEPLOYMENT_FREE_SITES.toLocaleString('en-US')} sites have no deployment charge.`
    : family === 'network'
      ? `${dollars(baseCost)} base project, ${dollars(siteActivationCost)} to activate ${sites.toLocaleString('en-US')} new sites beyond the first ${DEPLOYMENT_FREE_SITES.toLocaleString('en-US')}, and ${dollars(upgradeInstallationCost)} to install existing or already funded service upgrades there.`
      : `${dollars(baseCost)} base project plus ${dollars(upgradeInstallationCost)} to install ${targetLevel - currentLevel} service upgrade${targetLevel - currentLevel === 1 ? '' : 's'} across ${sites.toLocaleString('en-US')} sites beyond the first ${DEPLOYMENT_FREE_SITES.toLocaleString('en-US')}.`;
  return { family, currentLevel, targetLevel, billableSites: sites, baseCost, siteActivationCost, upgradeInstallationCost, deploymentCost, totalCost, detail };
}

/** Total upfront commitment price in integer cents. */
export function deploymentCost(levels: DeploymentLevels, family: Family, targetLevel = levels[family] + 1): Money {
  return quoteDeployment(levels, family, targetLevel).totalCost;
}
