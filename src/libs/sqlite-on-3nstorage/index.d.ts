import { Database as DBClass, BindParams as QueryParams, QueryExecResult as QueryResult } from './sqljs';
import { SingleProc, Action } from './synced';
export declare type Database = DBClass;
export declare type BindParams = QueryParams;
export declare type QueryExecResult = QueryResult;
declare type WritableFile = web3n.files.WritableFile;
export interface SaveOpts {
    skipUpload?: boolean;
}
export declare abstract class SQLiteOn3NStorage {
    protected readonly database: Database;
    protected readonly file: WritableFile;
    protected readonly syncProc: SingleProc;
    protected constructor(database: Database, file: WritableFile);
    static makeAndStart(file: WritableFile): Promise<SQLiteOn3NStorage>;
    private start;
    saveToFile(opts?: SaveOpts): Promise<void>;
    get db(): Database;
    sync<T>(action: Action<T>): Promise<T>;
    listTables(): string[];
}
export {};
