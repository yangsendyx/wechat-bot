import fs from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from "url";
import { Sequelize } from 'sequelize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const topPath = `${__dirname}/../..`;

if (!fs.existsSync(`${topPath}/data`)) fs.mkdirSync(`${topPath}/data`);
if (!fs.existsSync(`${topPath}/files`)) fs.mkdirSync(`${topPath}/files`);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: `${topPath}/data/db.sqlite`,
});


