import { DataTypes } from 'sequelize';

import {sequelize} from "../core/database";

export enum GameState {
    Created = "created",
    Started = "started",
    Ended = "ended"
}

export interface GameOptions {
    topic?: string;
    minPrice?: number;
}

const Game = sequelize.define('game', {
    topic: {
        type: DataTypes.STRING
    },
    state: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: GameState.Created
    },
    owner: {
        type: DataTypes.NUMBER,
        allowNull: false
    },
    ownerChat: {
        type: DataTypes.NUMBER,
        allowNull: false
    },
    ownerName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    inviteCode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    minPrice: {
        type: DataTypes.NUMBER
    },
    members: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    updatedAt: false,
});

export default Game;
