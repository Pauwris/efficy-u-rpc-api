export default FetchQueue;
declare const FetchQueue: {
    new (): {
        "__#9@#id": number;
        pleaseWait(): boolean;
        takeTurn(): void;
        finished(): void;
        sleep(): Promise<void>;
        waitMyTurn(): Promise<void>;
    };
    debug: boolean;
    forceSequential: boolean;
    waitTime: number;
    pending: boolean;
    fetchCount: number;
};
//# sourceMappingURL=fetch-queue.d.mts.map