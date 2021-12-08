import {Markup, Telegraf} from 'telegraf';
import {MembersItem, User} from "./schemas/membersItem";

import {register, waitTextReply, waitBooleanReply} from "./core/waiters";
import {nanoid} from "nanoid";

import {sequelize} from "./core/database";

import Game, {GameOptions, GameState} from "./schemas/game";
import {CouplesItem} from "./schemas/couplesItem";

import config from './config.json';
import createKeyValue from "./core/level";

import {chunks, shuffle} from "./core/arrays";

const bot = new Telegraf(config.token);

register(bot);

(async () => {
    await sequelize.sync();

    const members = createKeyValue<MembersItem>('storage/members');
    const couples = createKeyValue<CouplesItem>('storage/couples');

    bot.start(async ctx => {
       ctx.reply(`👁 ‍Добро пожаловать.\nДля начала пользования ботом необходимо только подписаться на канал разработчиков в Telegram @nnstd_team\n\nДля присоединения к существующей игре введите /accept\nДля создания новой игры введите /new`);
    });

    bot.command("new", async ctx => {
        if (ctx.chat.type !== 'private') {
            ctx.reply('Создание игр невозможно в групповом чате');
            return
        }

        let options: GameOptions = {};

        const needTopic = await waitBooleanReply(ctx, 'Хотите ввести тему?');

        if (needTopic) {
            const topic = await waitTextReply(ctx, 'Введите тему');
            if (!isNaN(topic.text)) {
                ctx.reply('💢 Введено неверное значение');
                return
            }

            options.topic = topic.text;
            await ctx.reply('Принято');
        }

        const needMinPrice = await waitBooleanReply(ctx, 'Хотите указать минимальную сумму для подарка?');
        if (needMinPrice) {
            const minPrice = await waitTextReply(ctx, 'Введите минимальную сумму');

            if (isNaN(minPrice.text)) {
                ctx.reply('💢 Введено неверное значение');
                return
            }

            options.minPrice = parseInt(minPrice.text);
            await ctx.reply('Принято');
        }

        const membersLink = nanoid(12);
        const inviteCode = nanoid(12);

        const game = await Game.create({
            owner: ctx.from.id,
            members: membersLink,
            inviteCode: inviteCode,
            ownerChat: ctx.chat.id,
            ownerName: `${ctx.from.first_name} ${ctx.from.last_name}`,
            ...options
        });

        // @ts-ignore
        ctx.reply(`✔ Игра успешно создана.\n\nИспользуйте нижеописанные данные для приглашения в игру новых пользователей:\nИдентификатор игры: ${game.id}\nПароль: ${inviteCode}`);
    });

    bot.command('accept', async ctx => {
        const code = await waitTextReply(ctx, 'Введите код приглашения');

        if (!isNaN(code.text)) {
            ctx.reply('💢 Введено неверное значение');
            return
        }

        Game.findOne({
            where: {
                inviteCode: code.text
            }
        }).then(async (game: any) => {
            if (game == null) {
                ctx.reply('💢 Игра не найдена. Проверьте правильность введенных данных');
                return;
            }

            if (game.owner === ctx.from.id) {
                ctx.reply('💢 Организатор уже является участником игры, и не может войти повторно');
                return;
            }

            const getName = async (): Promise<string> => {
                const needCustomName = await waitBooleanReply(ctx, 'Хотите ли вы изменить своё текущее имя? Оно будет видно всем другим игрокам, принимающим участие в игре');

                let name = ctx.from.last_name == null ? ctx.from.first_name : `${ctx.from.first_name} ${ctx.from.last_name}`;

                if (needCustomName) {
                    const r = await waitTextReply(ctx, 'Введите ваше имя. Мы оповестим организатора игры о том, что вы присоединились');
                    name = r.text;
                }

                return name
            }

            let d: MembersItem;
            let name: string;

            if (await members.has(game.members)) {
                d = await members.get(game.members);

                const duplicateIndex = d.list.findIndex(e => e.id === ctx.from.id);

                if (duplicateIndex !== -1) {
                    ctx.reply('❌ Вы уже принимаете участие в этой игре');
                    return
                }

                name = await getName();

                d.list.push({
                    id: ctx.from.id,
                    name: name
                });
            } else {
                name = await getName();

                d = {
                    list: [
                        {
                            id: ctx.from.id,
                            name: name
                        }
                    ]
                }
            }

            await members.set(game.members, d);

            ctx.reply('Вы успешно присоеденились к игре');
            await bot.telegram.sendMessage(game.ownerChat, `'${name}' присоединился к игре`);
        });
    });

    bot.on('callback_query', async ctx => {
        // @ts-ignore
        const parts = ctx.callbackQuery.data.split('|');

        switch (parts[0]) {
            case 'members':
                let d = JSON.parse(parts[1]);

                Game.findOne({
                    where: {
                        id: d.i
                    }
                }).then(async (game: any) => {
                    let list: Array<User>;

                    if (await members.has(game.members)) {
                        list = (await members.get(game.members)).list;
                    } else {
                        list = [];
                    }

                    let m = `1. ${game.ownerName} (организатор)\n`;

                    list.forEach((e, i) => m += `${i+2}. ${e.name}\n`);

                    await ctx.reply(m);
                    ctx.answerCbQuery();
                });
                break;

            case 'start_game':
                let da = JSON.parse(parts[1]);

                Game.findOne({
                    where: {
                        id: da.i
                    }
                }).then(async (game: any) => {
                    if (game == null) {
                        ctx.reply('💢 Игра не найдена');
                        ctx.answerCbQuery();
                        return;
                    }

                    let list: Array<User>;

                    if (!(await members.has(game.members))) {
                        ctx.reply('💢 Недостаточно игроков');
                        return;
                    }

                    list = (await members.get(game.members)).list;
                    // Добавляем создателя
                    list.push({
                        id: game.owner,
                        name: game.ownerName
                    });

                    if (list.length < 2 || list.length % 2 === 1) {
                        ctx.reply('💢 Недостаточно игроков');
                        return;
                    }

                    list = shuffle(list);
                    const couplesList = chunks(list, 2);
                    const couplesRaw = [];
                    couplesList.forEach((couple, i) => {
                        couplesRaw[i] = [];
                        couple.forEach((e, ie) => {
                            couplesRaw[i][ie] = e.id;
                            bot.telegram.sendMessage(e.id, `Вам был назначен счастливчик, который получит ваш подарок\n#${game.id}`);
                        });
                    });

                    await couples.set(game.members, couplesRaw);

                    game.state = GameState.Started;
                    game.save();

                    ctx.reply('Игра была успешно запущена');
                    ctx.answerCbQuery();
                });
                break;

            case 'end_game':
                let db = JSON.parse(parts[1]);

                Game.findOne({
                    where: {
                        id: db.i
                    }
                }).then(async (game: any) => {
                    if (game == null) {
                        ctx.reply('💢 Игра не найдена');
                        ctx.answerCbQuery();
                        return;
                    }

                    const membersList = (await members.get(game.members)).list;
                    membersList.push({
                        id: game.owner,
                        name: game.ownerName
                    });

                    const couplesList = await couples.get(game.members);

                    couplesList.forEach(c => {
                       c.forEach((ci, i) => {
                           const filtered = membersList.filter(e => e.id === c[0] || e.id === c[1]);
                           bot.telegram.sendMessage(ci, `Вы дарите подарок ${filtered.find(e => e.id !== ci).name}`);
                       });
                    });

                    await bot.telegram.sendMessage(game.owner, '✅ Игра закончена');
                    await game.destroy();

                    ctx.answerCbQuery();
                });
                break;
        }
    });

    bot.command('members', async ctx => {
        Game.findAll({
            where: {
                owner: ctx.from.id,
            }
        }).then((games: any[]) => {
            if (games.length === 0) {
                ctx.reply('ℹ Список игр пуст');
                return
            }

            let m = 'Выберите игру:\n';

            games.forEach((e, i) => {
                m += e.topic == null ? `${i+1}. №${e.id}\n` : `${i+1}. №${e.id} - ${e.topic}\n`;
            });

            ctx.reply(m, Markup.inlineKeyboard(games.map(e => Markup.button.callback(e.id.toString(), `members|${JSON.stringify({
                i: e.id
            })}`))));
        });
    });

    bot.command('begin', async ctx => {
        Game.findAll({
            where: {
                state: GameState.Created,
                owner: ctx.from.id
            }
        }).then((games: Array<any>) => {
            if (games.length === 0) {
                ctx.reply('ℹ Список игр пуст');
                return
            }

            ctx.reply('Выберите идентификатор игры, которую необходимо начать', Markup.inlineKeyboard(games.map(e => Markup.button.callback(e.id.toString(), `start_game|${JSON.stringify({
                i: e.id
            })}`))));
        });
    });

    bot.command('end', async ctx => {
        Game.findAll({
            where: {
                state: GameState.Started,
                owner: ctx.from.id
            }
        }).then((games: Array<any>) => {
            if (games.length === 0) {
                ctx.reply('ℹ Список игр пуст');
                return
            }

            ctx.reply('Выберите идентификатор игры, которую необходимо завершить', Markup.inlineKeyboard(games.map(e => Markup.button.callback(e.id.toString(), `end_game|${JSON.stringify({
                i: e.id
            })}`))));
        });
    });

    bot.launch().then(() => {
        console.log('Бот запущен');
    });
})()
