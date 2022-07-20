const Tree = require("./tree.js");
const Transaction = require("./transaction.js")

const buildMimc7 = require("circomlibjs").buildMimc7;

const toHexString = (bytes) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

module.exports = class AccountTree extends Tree {
  constructor(
      _accounts
  ) {
    super(_accounts.map((x) => x.hashAccount()))
    this.accounts = _accounts
  }

  async processTxArray(txTree) {
    let mimcjs = await buildMimc7()
    let F = mimcjs.F

    const originalState = this.root;
    const txs = txTree.txs;

    let paths2txRoot = new Array(txs.length);
    let paths2txRootPos = new Array(txs.length);
    let deltas = new Array(txs.length);

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];

      // verify tx exists in tx tree
      const [txProof, txProofPos] = txTree.getTxProofAndProofPos(tx);
      txTree.checkTxExistence(tx, txProof);
      paths2txRoot[i] = [];
      for (let j = 0; j < txProof.length; j++){
        paths2txRoot[i].push(F.toString(txProof[j]));
      }

      paths2txRootPos[i] = txProofPos;

      // process transaction
      console.log("Debug: processing tx:", i);
      deltas[i] = this.processTx(tx);
    }

    return {
      originalState: originalState,
      txTree: txTree,
      paths2txRoot: paths2txRoot,
      paths2txRootPos: paths2txRootPos,
      deltas: deltas
    }
  }

  processTx(tx) {
    const sender = this.findAccountByPubkey(tx.fromX, tx.fromY);
    const indexFrom = sender.index;
    const balanceFrom = sender.balance;

    const receiver = this.findAccountByPubkey(tx.toX, tx.toY);
    const indexTo = receiver.index;
    const balanceTo = receiver.balance;
    const nonceTo = receiver.nonce;
    const tokenTypeTo = receiver.tokenType;

    const [senderProof, senderProofPos] = this.getAccountProof(sender);
    this.checkAccountExistence(sender, senderProof);
    tx.checkSignature();
    this.checkTokenTypes(tx);

    sender.debitAndIncreaseNonce(tx.amount);
    this.leafNodes[sender.index] = sender.hash;

    this.updateInnerNodes(sender.hash, sender.index, senderProof);
    this.root = this.innerNodes[0][0]
    const rootFromNewSender = this.root;

    const [receiverProof, receiverProofPos] = this.getAccountProof(receiver);

    this.checkAccountExistence(receiver, receiverProof);

    receiver.credit(tx.amount);
    this.leafNodes[receiver.index] = receiver.hash;
    this.updateInnerNodes(receiver.hash, receiver.index, receiverProof);
    this.root = this.innerNodes[0][0]
    const rootFromNewReceiver = this.root;

    return {
      senderProof: senderProof,
      senderProofPos: senderProofPos,
      rootFromNewSender: rootFromNewSender,
      receiverProof: receiverProof,
      receiverProofPos: receiverProofPos,
      rootFromNewReceiver: rootFromNewReceiver,
      indexFrom: indexFrom,
      balanceFrom: balanceFrom,
      indexTo: indexTo,
      balanceTo: balanceTo,
      nonceTo: nonceTo,
      tokenTypeTo: tokenTypeTo
    }
  }

  checkTokenTypes(tx) {
    const sender = this.findAccountByPubkey(tx.fromX, tx.fromY)
    const receiver = this.findAccountByPubkey(tx.toX, tx.toY)
    const sameTokenType = (
      (tx.tokenType == sender.tokenType && tx.tokenType == receiver.tokenType) ||
      receiver.tokenType == 0 // withdraw token type doesn't have to match
    );
    if (!sameTokenType) {
      throw new Error("token types do not match")
    }
  }

  checkAccountExistence(account, accountProof) {
    if (!this.verifyProof(account.hash, account.index, accountProof)) {
      console.log("given account hash", account.hash)
      console.log("given account proof", accountProof)

      throw new Error("account does not exist")
    }
  }

  getAccountProof(account) {
    const proofObj = this.getProof(account.index)
    return [proofObj.proof, proofObj.proofPos]
  }

  findAccountByPubkey(pubkeyX, pubkeyY) {
    if (pubkeyX == 0 && pubkeyY == 0) {
      return this.accounts[0]
    }
    // use slice to skip zeroAccount
    const account = this.accounts.slice(1).filter(
        (acct) => (
          acct.pubkeyX != 0 &&
          acct.pubkeyY != 0 &&
          toHexString(acct.pubkeyX) == toHexString(pubkeyX) &&
          toHexString(acct.pubkeyY) == toHexString(pubkeyY)
        )
    )[0];
    return account
  }

  generateEmptyTx(pubkeyX, pubkeyY, index, prvkey) {
    const sender = this.findAccountByPubkey(pubkeyX, pubkeyY);
    const nonce = sender.nonce;
    const tokenType = sender.tokenType;
    let tx = new Transaction(
        pubkeyX, pubkeyY, index,
        pubkeyX, pubkeyY,
        nonce, 0, tokenType
    );
    tx.signTxHash(prvkey);
  }
}
