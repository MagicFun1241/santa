import {Context, Markup, Telegraf} from "telegraf";

type WaiterPromiseFunc = (data: any) => {}

interface Waiter {
    callbacks: Array<WaiterPromiseFunc>;
    timeout: NodeJS.Timeout;
    from: number;
    type: 'boolean' | 'text';
}

const promises = new Map<number, Waiter>();

export function register(bot: Telegraf) {
    bot.action('answer_yes', async ctx => {
        if (promises.has(ctx.chat.id)) {
            const w = promises.get(ctx.chat.id);
            if (w.from !== ctx.from.id) {
                await ctx.reply('Ввод отменён');
            }

            w.callbacks[0](true);
        } else ctx.reply('Ответ на вопрос уже был дан');

        ctx.answerCbQuery()
    });

    bot.action('answer_no', async ctx => {
        if (promises.has(ctx.chat.id)) {
            const w = promises.get(ctx.chat.id);
            if (w.from !== ctx.from.id) {
                await ctx.reply('Ввод отменён');
            }

            w.callbacks[0](false);
        } else ctx.reply('Ответ на вопрос уже был дан');

        ctx.answerCbQuery()
    });

    bot.use(async (ctx, next) => {
        try {
            const d = await bot.telegram.getChatMember("@nnstd_team", ctx.from.id);
            if (d.status === 'left') {
                await ctx.reply(`⛔ Для работы бота необходимо подписаться на канал разработчиков в Telegram: @nnstd_team`);
                return
            }
        } catch (e) {
            await ctx.reply(`⛔ Для работы бота необходимо подписаться на канал разработчиков в Telegram: @nnstd_team`);
            return
        }
       if (promises.has(ctx.chat.id)) {
           const w = promises.get(ctx.chat.id);
           if (w.from !== ctx.from.id) {
               await ctx.reply('Ввод отменён');
           }

           if (w.type === 'boolean') {
               // @ts-ignore
               w.callbacks[0](ctx.message?.text.toLowerCase() === 'да');
           } else {
               w.callbacks[0](ctx.message);
           }
           clearTimeout(w.timeout);
       }

       next();
    });
}

export function waitTextReply(ctx: Context, text: string): Promise<any> {
    return new Promise<any>(async (resolve, reject) => {
        await ctx.reply(text);

        promises.set(ctx.chat.id, {
            // @ts-ignore
            callbacks: [resolve, reject],
            timeout: setTimeout(() => {
                promises.delete(ctx.from.id)
            }, 5 * 60 * 1000),
            from: ctx.from.id,
            type: 'text',
        });
    });
}

export function waitBooleanReply(ctx: Context, text: string): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        await ctx.reply(text, Markup.inlineKeyboard([
            Markup.button.callback('Да', 'answer_yes'),
            Markup.button.callback('Нет', 'answer_no'),
        ]));

        promises.set(ctx.chat.id, {
            // @ts-ignore
            callbacks: [resolve, reject],
            timeout: setTimeout(() => {
                promises.delete(ctx.from.id)
            }, 5 * 60 * 1000),
            from: ctx.from.id,
            type: 'boolean',
        });
    });
}
