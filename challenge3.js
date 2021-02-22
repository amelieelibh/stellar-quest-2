const { Server, Keypair, TransactionBuilder, FeeBumpTransaction, BASE_FEE, Networks, Operation, Asset } = require('stellar-sdk')
const parseError = require('@runkit/tyvdh/parse-error/2.0.0')
const { chain } = require('lodash')
const BigNumber = require('bignumber.js')

try {
    const server = new Server('https://horizon-testnet.stellar.org')
    
    const myKeypair = Keypair.fromSecret('SB4RHDLBJODLQJ4O77LTXOF6VMUO3XYJ73O7CXE37WPP2TI25JTTV4IH')
    const myPublicKey = myKeypair.publicKey()
    
    await server
    .loadAccount(myPublicKey)
    .then(async (account) => {
        const {records} = await account.transactions({order: 'desc', limit: 200})
        const successTxn = chain(records)
        .filter((txn) =>
            txn.fee_bump_transaction 
            && txn.inner_transaction
            && txn.fee_account !== txn.source_account
            && txn.fee_account !== myPublicKey
            && txn.source_account === myPublicKey
        )
        .filter((txn) => {
            const transaction = new FeeBumpTransaction(txn.envelope_xdr, Networks.TESTNET)
            return transaction.innerTransaction.source === myPublicKey
        })
        .first()
        .value()
    
        if (successTxn) 
            return console.log('Account has already successfully submitted a fee bump transaction')
    
        console.log('Account exists and is ready to submit a fee bump transaction')
    
        const feeSourceKeypair = Keypair.random()
        const feeSourcePublicKey = feeSourceKeypair.publicKey()

        await server
        .friendbot(feeSourcePublicKey)
        .call()
        .then(() => console.log('Random fee source account was successfully funded'))
    
        const innerTx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
        })
        .addOperation(Operation.bumpSequence({
            bumpTo: '0'
        }))
        .setTimeout(0)
        .build()

        innerTx.sign(myKeypair)

        console.log('Inner transaction has been prepared and signed')
        
        const feeBumpTxn = new TransactionBuilder.buildFeeBumpTransaction(
            feeSourceKeypair, 
            BASE_FEE, 
            innerTx, 
            Networks.TESTNET
        )
        
        feeBumpTxn.sign(feeSourceKeypair)
        
        await server.submitTransaction(feeBumpTxn)
        console.log('Fee bump transaction was successfully submitted')
    })
}

catch(err) {
    console.error(parseError(err))
}