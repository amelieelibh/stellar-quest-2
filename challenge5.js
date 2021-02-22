const { Server, Keypair, TransactionBuilder, BASE_FEE, Networks, Operation, Asset, Claimant } = require('stellar-sdk')
const parseError = require('@runkit/tyvdh/parse-error/2.0.0')
const { chain } = require('lodash')
const moment = require('moment')
const BigNumber = require('bignumber.js')

try {
    const server = new Server('https://horizon-testnet.stellar.org')
    
    const myKeypair = Keypair.fromSecret('SB4RHDLBJODLQJ4O77LTXOF6VMUO3XYJ73O7CXE37WPP2TI25JTTV4IH')
    const myPublicKey = myKeypair.publicKey()
    
    await server
    .loadAccount(myPublicKey)
    .then(async (account) => {
        const {records} = await server
        .claimableBalances()
        .claimant(myPublicKey)
        .order('desc')
        .limit(200)
        .call()
        const pendingClaimableBalance = chain(records)
        .filter((record) => {
            const claimant = record.claimants[0]

            return (
                record.claimants.length === 1
                && new BigNumber(record.amount).eq(100)
                && record.asset === 'native'
                && claimant.destination === myPublicKey
                && claimant.predicate
                && claimant.predicate.not
                && claimant.predicate.not.abs_before
                && moment.utc(claimant.predicate.not.abs_before).isSameOrAfter(moment.utc('2020-12-28T10:00:00-04:00'))
            )
        })
        .first()
        .value()

        if (!pendingClaimableBalance)
            return console.log('Account has no pending claimable balances')
    
        console.log('Pending claimable balance exists and is ready to claim')
    
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
        })
        .addOperation(Operation.claimClaimableBalance({
            balanceId: pendingClaimableBalance.id
        }))
        .setTimeout(0)
        .build()

        transaction.sign(myKeypair)
        
        await server.submitTransaction(transaction)
        console.log('Claimable balance was successfully claimed')
    })
}

catch(err) {
    console.error(parseError(err))
}