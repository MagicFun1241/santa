import level from 'level';

export default function createKeyValue<T>(path: string) {
    const db = level(path);

    return {
        get: (key: string): Promise<T> => {
            return new Promise<T>((resolve, reject) => {
                db.get(key, (err, value) => {
                    if (err != null) {
                        reject(err);
                        return;
                    }

                    resolve(JSON.parse(value));
                })
            })
        },
        set: (key: string, value: T): Promise<void> => {
           return new Promise((resolve, reject) => {
               db.put(key, JSON.stringify(value), err => {
                   if (err != null) {
                       reject(err);
                       return;
                   }

                   resolve();
               });
           })
        },
        has: (key: string): Promise<boolean> => {
            return new Promise((resolve) => {
                try {
                    db.get(key, err => {
                        if (err) {
                            resolve(false);
                            return;
                        }

                        resolve(true);
                    });
                } catch (e) {
                    resolve(false);
                }
            });
        },
    }
}
