const analyticsManager = require('./analyticsManager');

class LotteryManager {
    constructor() {
        this.lotteries = new Map();
    }

    createLottery(options) {
        const lotteryId = Date.now().toString();
        const lottery = {
            id: lotteryId,
            prize: options.prize,
            winners: options.winners,
            minParticipants: options.minParticipants || 1,
            terms: options.terms,
            startTime: Date.now(),
            endTime: Date.now() + options.duration,
            participants: new Map(), // Changed to Map to store ticket counts
            maxTicketsPerUser: options.maxTicketsPerUser || 100,
            ticketPrice: options.ticketPrice || 1,
            messageId: null,
            channelId: null,
            guildId: null,
            isManualDraw: options.isManualDraw,
            status: 'pending',
            createdBy: options.createdBy,
            totalTickets: 0
        };

        this.lotteries.set(lotteryId, lottery);
        return lottery;
    }

    getLottery(lotteryId) {
        return this.lotteries.get(lotteryId);
    }

    getAllActiveLotteries() {
        return Array.from(this.lotteries.values())
            .filter(lottery => lottery.status === 'active');
    }

    addParticipant(lotteryId, userId, tickets = 1) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== 'active') return false;

        const currentTickets = lottery.participants.get(userId) || 0;
        if (currentTickets + tickets > lottery.maxTicketsPerUser) {
            return false;
        }

        lottery.participants.set(userId, currentTickets + tickets);
        lottery.totalTickets += tickets;
        analyticsManager.trackParticipation(lotteryId, userId, 'join', tickets);
        return true;
    }

    removeParticipant(lotteryId, userId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== 'active') return false;

        const tickets = lottery.participants.get(userId);
        if (!tickets) return false;

        lottery.totalTickets -= tickets;
        lottery.participants.delete(userId);
        analyticsManager.trackParticipation(lotteryId, userId, 'leave', tickets);
        return true;
    }

    drawWinners(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.status !== 'active') return null;

        const totalTickets = lottery.totalTickets;
        if (totalTickets < lottery.minParticipants) return null;

        const winners = new Set();
        const numWinners = Math.min(lottery.winners, lottery.participants.size);
        const ticketArray = [];

        // Create weighted ticket array
        for (const [userId, ticketCount] of lottery.participants) {
            for (let i = 0; i < ticketCount; i++) {
                ticketArray.push(userId);
            }
        }

        // Draw winners with weighted probability
        while (winners.size < numWinners && ticketArray.length > 0) {
            const randomIndex = Math.floor(Math.random() * ticketArray.length);
            const winner = ticketArray[randomIndex];
            winners.add(winner);
            // Remove all tickets of the winner to prevent duplicate wins
            ticketArray.splice(0, ticketArray.length, ...ticketArray.filter(id => id !== winner));
        }

        lottery.status = 'ended';
        const winnerArray = Array.from(winners);
        analyticsManager.recordWinners(lotteryId, winnerArray);
        return winnerArray;
    }

    cancelLottery(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return false;

        lottery.status = 'cancelled';
        return true;
    }

    getTimeRemaining(lotteryId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return null;

        const remaining = lottery.endTime - Date.now();
        return Math.max(0, remaining);
    }

    getParticipantTickets(lotteryId, userId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery) return 0;
        return lottery.participants.get(userId) || 0;
    }

    getWinningProbability(lotteryId, userId) {
        const lottery = this.getLottery(lotteryId);
        if (!lottery || lottery.totalTickets === 0) return 0;

        const userTickets = lottery.participants.get(userId) || 0;
        return (userTickets / lottery.totalTickets) * 100;
    }
}

module.exports = new LotteryManager();