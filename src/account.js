const buildMimc7 = require("circomlibjs").buildMimc7;

module.exports = class Account {
  constructor(
      _index = 0, _pubkeyX = 0, _pubkeyY = 0,
      _balance = 0, _nonce = 0, _tokenType = 0,
      _prvkey = 0
  ) {
    this.index = _index;
    this.pubkeyX = _pubkeyX;
    this.pubkeyY = _pubkeyY;
    this.balance = BigInt(_balance);
    this.nonce = _nonce;
    this.tokenType = _tokenType;

    this.prvkey = _prvkey;
    this.hash = undefined
    this.mimcjs = undefined
    this.eddsa = undefined
  }

  async initialize() {
    this.mimcjs = await buildMimc7()
    this.hash = this.hashAccount()
  }

  hashAccount() {
    let input = [
      // this.index.toString(),
      this.pubkeyX,
      this.pubkeyY,
      this.balance.toString(),
      this.nonce,
      this.tokenType
    ]
    return this.mimcjs.multiHash(input)
  }

  debitAndIncreaseNonce(amount) {
    this.balance = this.balance - amount;
    this.nonce++;
    this.hash = this.hashAccount()
  }

  credit(amount) {
    if (this.index > 0) { // do not credit zero leaf
      this.balance = this.balance + amount;
      this.hash = this.hashAccount()
    }
  }
}
