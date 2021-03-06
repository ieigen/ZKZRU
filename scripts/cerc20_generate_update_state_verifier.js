const 
buildEddsa = require("circomlibjs").buildEddsa;
const buildMimc7 = require("circomlibjs").buildMimc7;
const buildBabyJub = require("circomlibjs").buildBabyJub;
const fs = require("fs");
const Tree = require("../src/tree.js");
const Account = require("../src/cerc20Account.js");
const AccountTree = require("../src/cerc20AccountTree");
const Transaction = require("../src/cerc20Transaction");
const TxTree = require("../src/txTree");
const treeHelper = require("../src/treeHelper");
const getCircuitInput = require("../src/cerc20CircuitInput");
const pc = require("@ieigen/anonmisc/lib/pedersen_babyJubjub.ts");

BigInt.prototype.toJSON = function() {
  return this.toString()
}

// const TX_DEPTH = 8
// const BAL_DEPTH = 12

const TX_DEPTH = 2
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

  const zeroHash = zeroAccount.hashAccount()
  
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
    0, 0, 0, 0, coordinatorPrvkey
  );
  await coordinator.initialize()

  accounts.push(coordinator);
  
 
  // generate A, B, C, D, E, F accounts

  const numAccounts = 6
  const tokenTypes = [2, 1, 2, 1, 2, 1];

  // generate balance commitment
  const balances = [1000, 20, 200, 100, 500, 20];
  var balanceCommX = []
  var balanceCommY = []
  var r
  var comm
  let H = await pc.generateH()
  for (var i = 0; i < numAccounts; i++){
    r = await pc.generateRandom()
    comm = await pc.commitTo(H, r, balances[i])
    balanceCommX.push(comm[0])
    balanceCommY.push(comm[1])
  }

  
  const nonces = [0, 0, 0, 0, 0, 0];

  for (var i = 0; i < numAccounts; i++){
    prvkey = generatePrvkey(i + 2);
    pubkey = generatePubkey(prvkey);
    account = new Account(
      i + 2, // index
      pubkey[0], // pubkey x coordinate
      pubkey[1], // pubkey y coordinate
      balanceCommX[i], // balance commitment x
      balanceCommY[i], // balance commitment Y
      nonces[i], // nonce
      tokenTypes[i], // tokenType,
      prvkey
    )
    await account.initialize()
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

  // first4Accounts pad with 12 zeroAccouts
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

  fromAccountsIdx = [2, 4, 3, 1]
  toAccountsIdx = [4, 0, 5, 0]
  
  // generate amount commitment
  const amounts = [500, 200, 10, 0]
  var amountCommX = []
  var amountCommY = []
  for (var i = 0; i < 4; i++){
    if (amounts[i] == 0) {
      amountCommX.push(0)
      amountCommY.push(0)
    } else {
      r = await pc.generateRandom()
      comm = await pc.commitTo(H, r, amounts[i])
      amountCommX.push(comm[0])
      amountCommY.push(comm[1])
    } 
  }

  const testInfo = {
    "balanceCommA": [F.toString(balanceCommX[0]), F.toString(balanceCommY[0])],
    "balanceCommB": [F.toString(balanceCommX[1]), F.toString(balanceCommY[1])],
    "balanceCommC": [F.toString(balanceCommX[2]), F.toString(balanceCommY[2])],
    "balanceCommD": [F.toString(balanceCommX[3]), F.toString(balanceCommY[3])],
    "balanceCommE": [F.toString(balanceCommX[4]), F.toString(balanceCommY[4])],
    "balanceCommF": [F.toString(balanceCommX[5]), F.toString(balanceCommY[5])],
    "amountCommX": F.toString(amountCommX[1]),
    "amountCommY": F.toString(amountCommY[1])
  }

  fs.writeFileSync(
    "testInfo.json",
    JSON.stringify(testInfo),
    "utf-8"
  );

  const txTokenTypes = [2, 2, 1, 0]
  const txNonces = [0, 0, 0, 0]

  var txs = new Array(TX_DEPTH ** 2)

  for (var i = 0; i < txs.length; i++){
    fromAccount = paddedAccounts2[fromAccountsIdx[i]];
    toAccount = paddedAccounts2[toAccountsIdx[i]];
    tx = new Transaction(
      fromAccount.pubkeyX,
      fromAccount.pubkeyY,
      fromAccount.index,
      toAccount.pubkeyX,
      toAccount.pubkeyY,
      txNonces[i],
      amountCommX[i],
      amountCommY[i],
      txTokenTypes[i]
    );
    await tx.initialize()

    tx.hashTx();
    tx.signTxHash(fromAccount.prvkey);

    tx.checkSignature()

    txs[i] = tx;
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
