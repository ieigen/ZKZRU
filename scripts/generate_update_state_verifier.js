const buildEddsa = require("circomlibjs").buildEddsa;
const buildMimc7 = require("circomlibjs").buildMimc7;
const buildBabyJub = require("circomlibjs").buildBabyJub;
const fs = require("fs");

// const {
//   Tree,
//   Account,
//   AccountTree,
//   Transaction,
//   TxTree,
//   prover,
//   treeHelper,
//   getCircuitInput
// } = require("@ieigen/zkzru");

console.log('module---->',module)

const Tree = require("../src/tree.js");
const Account = require("../src/account.js");
const AccountTree = require("../src/accountTree");
const Transaction = require("../src/transaction");
const TxTree = require("../src/txTree");
const treeHelper = require("../src/treeHelper");
const getCircuitInput = require("../src/circuitInput");
const { mimc7Contract } = require("circomlibjs");


BigInt.prototype.toJSON = function() {
  return this.toString()
}

// const TX_DEPTH = 8
// const BAL_DEPTH = 12

const TX_DEPTH = 4
const BAL_DEPTH = 4

function generatePrvkey(i){
  prvkey = Buffer.from(i.toString().padStart(64,'0'), "hex");
  return prvkey;
}

const main = async() => {
  await treeHelper.initialize()

  let eddsa = await buildEddsa();
  let mimcjs = await buildMimc7();

  let F = mimcjs.F;

  // get empty account tree hashes
  let zeroAccount = new Account();
  await zeroAccount.initialize();

  const zeroHash = await zeroAccount.hashAccount()
  const numLeaves = 2**BAL_DEPTH;
  const zeroLeaves = new Array(numLeaves).fill(zeroHash)

  const zeroTree = new Tree(zeroLeaves);

  var zeroCache = [zeroHash]

  for (var i = BAL_DEPTH - 1; i >= 0; i--){
    zeroCache.unshift(zeroTree.innerNodes[i][0])
  }

  var accounts = [zeroAccount];

  function generatePubkey(prvkey){
    pubkey = eddsa.prv2pub(prvkey);
    return pubkey;
  }

  const coordinatorPrvkey = generatePrvkey(1);
  const coordinatorPubkey = generatePubkey(coordinatorPrvkey);
  const coordinator = new Account(
    1, coordinatorPubkey[0], coordinatorPubkey[1],
    0, 0, 0, coordinatorPrvkey
  );
  await coordinator.initialize()

  accounts.push(coordinator);

  // generate A, B, C, D, E, F accounts

  const numAccounts = 14
  const tokenTypes = [2, 2, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1];
  const balances = [1000, 1000, 200, 300, 500, 200, 1000, 200, 200, 300, 500, 200, 1000, 1000];
  const nonces = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  for (var i = 0; i < numAccounts; i++){
    prvkey = generatePrvkey(i + 2);
    pubkey = generatePubkey(prvkey);
    account = new Account(
      i + 2, // index
      pubkey[0], // pubkey x coordinate
      pubkey[1], // pubkey y coordinate
      balances[i], // balance
      nonces[i], // nonce
      tokenTypes[i], // tokenType,
      prvkey
    )
    account.mimcjs=mimcjs
    account.eddsa=eddsa
    account.hash=account.hashAccount()
    accounts.push(account);

  }

  const first4Accounts = accounts.slice(0,4)
  const first4Subtree = new AccountTree(first4Accounts)

  const first4SubtreeRoot = first4Subtree.root
  console.log('first4SubtreeRoot', F.toString(first4SubtreeRoot))

  const first4SubtreeProof = zeroCache.slice(1, BAL_DEPTH - Math.log2(4) + 1).reverse()
  const rootAfterFirstDeposit = await treeHelper.rootFromLeafAndPath(first4SubtreeRoot, 0, first4SubtreeProof)

  let shouldCache0 = treeHelper.rootFromLeafAndPath(zeroCache[BAL_DEPTH - Math.log2(4)], 0, first4SubtreeProof)
  // check empty subtree proof
  console.log('subtree is empty',
    F.toString(zeroCache[0]) === F.toString(shouldCache0)
    //treeHelper.rootFromLeafAndPath(zeroCache[BAL_DEPTH - Math.log2(4)], 0, first4SubtreeProof)
  )
  console.log('new root after first deposit', F.toString(rootAfterFirstDeposit))

  const paddedAccounts1 = treeHelper.padArray(
    first4Accounts, zeroAccount, numLeaves
  )

  const accountTree1 = new AccountTree(paddedAccounts1)

  const root1 = accountTree1.root

  console.log(
    'root after first deposit is correct',
    F.toString(root1) == F.toString(rootAfterFirstDeposit))

  const next4Accounts = accounts.slice(4,8)
  const next4Subtree = new AccountTree(next4Accounts)

  const next4SubtreeRoot = next4Subtree.root

  console.log('next4SubtreeRoot', F.toString(next4SubtreeRoot))

  var next4SubtreeProof = zeroCache.slice(1, BAL_DEPTH - Math.log2(4) + 1).reverse()
  next4SubtreeProof[0] = first4SubtreeRoot
  console.log('first8SubtreeProof', F.toString(next4SubtreeProof))
  const rootAfterSecondDeposit = treeHelper.rootFromLeafAndPath(next4SubtreeRoot, 1, next4SubtreeProof)

  // check empty subtree proof
  let shouldNext4SubtreeProof = treeHelper.rootFromLeafAndPath(zeroCache[BAL_DEPTH - Math.log2(4)], 1, next4SubtreeProof)
  console.log('subtree is empty',
    F.toString(rootAfterFirstDeposit) ===
    F.toString(shouldNext4SubtreeProof)
    //treeHelper.rootFromLeafAndPath(zeroCache[BAL_DEPTH - Math.log2(4)], 1, next4SubtreeProof)
  )
  console.log('new root after second deposit',
    F.toString(rootAfterSecondDeposit)
  )

  const paddedAccounts2 = treeHelper.padArray(
    accounts, zeroAccount, numLeaves
  )
  const accountTree2 = new AccountTree(paddedAccounts2)
  const root2 = accountTree2.root

  console.log(
    'root after second deposit is correct',
    F.toString(root2) === F.toString(rootAfterSecondDeposit))

  // generate tx's:
  // 1. Alice --500--> Charlie ,
  // 2. Charlie --200--> withdraw,
  // 3. Bob --10--> Daenerys,
  // 4. empty tx (operator --0--> withdraw)

  fromAccountsIdx = [2, 4, 3, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
  toAccountsIdx = [4, 0, 5, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]

  const amounts = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10]
  const txTokenTypes = [2, 2, 2, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]
  const txNonces = [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

  var txs = new Array(2 ** TX_DEPTH)

  for (var i = 0; i < 2 ** TX_DEPTH; i++){
    fromAccount = paddedAccounts2[fromAccountsIdx[i]];
    toAccount = paddedAccounts2[toAccountsIdx[i]];
    tx = new Transaction(
      fromAccount.pubkeyX,
      fromAccount.pubkeyY,
      fromAccount.index,
      toAccount.pubkeyX,
      toAccount.pubkeyY,
      txNonces[i],
      amounts[i],
      txTokenTypes[i]
    );
    tx.eddsa=eddsa
    tx.mimcjs=mimcjs
    tx.hashTx();
    tx.signTxHash(fromAccount.prvkey);
  
    tx.checkSignature()
    txs[i] = tx;

    // const receiver=findAccountByPubkey(toAccount.pubkeyX,toAccount.pubkeyY)
    // console.log("receiver",receiver,"pubkeyX",pubkeyX,"pubkeyY",pubkeyY)
  }

  const txTree = new TxTree(txs);

  const stateTransition = await accountTree2.processTxArray(txTree);
  const inputs = await getCircuitInput(stateTransition);

  fs.writeFileSync(
    "input.json",
    JSON.stringify(inputs),
    "utf-8"
  );
}

main().then(() => {
  console.log("Done")
})