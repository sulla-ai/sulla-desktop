// Import all rdctl tool registrations
import { rdctlExtensionRegistration } from './rdctl_extension';
import { rdctlInfoRegistration } from './rdctl_info';
import { rdctlListSettingsRegistration } from './rdctl_list_settings';
import { rdctlResetRegistration } from './rdctl_reset';
import { rdctlSetRegistration } from './rdctl_set';
import { rdctlShellRegistration } from './rdctl_shell';
import { rdctlShutdownRegistration } from './rdctl_shutdown';
import { rdctlSnapshotRegistration } from './rdctl_snapshot';
import { rdctlStartRegistration } from './rdctl_start';
import { rdctlVersionRegistration } from './rdctl_version';

// Export all rdctl tool registrations as an array
export const rdctlToolRegistrations = [
  rdctlExtensionRegistration,
  rdctlInfoRegistration,
  rdctlListSettingsRegistration,
  rdctlResetRegistration,
  rdctlSetRegistration,
  rdctlShellRegistration,
  rdctlShutdownRegistration,
  rdctlSnapshotRegistration,
  rdctlStartRegistration,
  rdctlVersionRegistration,
];
