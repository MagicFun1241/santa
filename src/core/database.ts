import {Sequelize} from "sequelize";

export const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './storage/database.sqlite',
    logging: false,
});
