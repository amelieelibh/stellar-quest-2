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
        const successClaimableBalances = chain(records)
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

        if (successClaimableBalances)
            return console.log('Account has already successfully submitted a claimable balance')
    
        console.log('Account exists and is ready to submit a claimable balance')
    
        const transaction = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
        })
        .addOperation(Operation.createClaimableBalance({
            asset: Asset.native(),
            amount: '100',
            claimants: [
                new Claimant(
                    myPublicKey,
                    Claimant.predicateNot(
                        Claimant.predicateBeforeAbsoluteTime(moment.utc('2020-12-28T10:00:00-04:00').format('X'))
                    )
                  )
            ]
        }))
        .setTimeout(0)
        .build()

        transaction.sign(myKeypair)
        
        await server.submitTransaction(transaction)
        console.log('Claimable balance was successfully submitted')
    })
}

catch(err) {
    console.error(parseError(err))
}