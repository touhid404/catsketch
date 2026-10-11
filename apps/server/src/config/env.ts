import dotenv from 'dotenv';
import path from 'node:path';
// The source and compiled config folders are both four levels below the workspace.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
