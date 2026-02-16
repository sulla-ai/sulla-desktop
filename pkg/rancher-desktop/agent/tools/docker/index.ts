// Import all docker tool registrations
import { dockerBuildRegistration } from './docker_build';
import { dockerExecRegistration } from './docker_exec';
import { dockerImagesRegistration } from './docker_images';
import { dockerLogsRegistration } from './docker_logs';
import { dockerPsRegistration } from './docker_ps';
import { dockerPullRegistration } from './docker_pull';
import { dockerRmRegistration } from './docker_rm';
import { dockerRunRegistration } from './docker_run';
import { dockerStopRegistration } from './docker_stop';

// Export all docker tool registrations as an array
export const dockerToolRegistrations = [
  dockerBuildRegistration,
  dockerExecRegistration,
  dockerImagesRegistration,
  dockerLogsRegistration,
  dockerPsRegistration,
  dockerPullRegistration,
  dockerRmRegistration,
  dockerRunRegistration,
  dockerStopRegistration,
];
