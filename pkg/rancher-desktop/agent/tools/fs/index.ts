import { fsAppendFileRegistration } from './append_file';
import { fsCopyPathRegistration } from './copy_path';
import { fsDeletePathRegistration } from './delete_path';
import { fsListDirRegistration } from './list_dir';
import { fsMkdirRegistration } from './mkdir';
import { fsMovePathRegistration } from './move_path';
import { fsPathInfoRegistration } from './path_info';
import { fsReadFileRegistration } from './read_file';
import { fsWriteFileRegistration } from './write_file';

export const fsToolRegistrations = [
  fsAppendFileRegistration,
  fsCopyPathRegistration,
  fsDeletePathRegistration,
  fsListDirRegistration,
  fsMkdirRegistration,
  fsMovePathRegistration,
  fsPathInfoRegistration,
  fsReadFileRegistration,
  fsWriteFileRegistration,
];
