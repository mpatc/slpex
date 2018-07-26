import { Component } from '@angular/core';
import BITBOXCli = require("bitbox-cli/lib/bitbox-cli");

let BITBOX = new BITBOXCli.default();

let langs = [
  'english',
  'chinese_simplified',
  'chinese_traditional',
  'korean',
  'japanese',
  'french',
  'italian',
  'spanish'
];

let lang = langs[3];

// create 256 bit BIP39 mnemonic
let mnemonic = BITBOX.Mnemonic.generate(256, BITBOX.Mnemonic.wordLists()[lang]);

// root seed buffer
let rootSeed = BITBOX.Mnemonic.toSeed(mnemonic);

// master HDNode
let masterHDNode = BITBOX.HDNode.fromSeed(rootSeed, 'bitcoincash');

// HDNode of BIP44 account
let account = BITBOX.HDNode.derivePath(masterHDNode, "m/44'/145'/0'");

// derive the first external change address HDNode which is going to spend utxo
let change = BITBOX.HDNode.derivePath(account, "0/0");

// get the cash address
let cashAddress = BITBOX.HDNode.toCashAddress(change);

@Component({
  selector: 'bitbox',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  mnemonic;
  txid;
  lang;
  hex;
  addresses = [];
  constructor(){
    this.mnemonic = mnemonic;
    this.lang = lang;

    BITBOX.Address.utxo(cashAddress).then((result) => {
      if(!result[0]) {
        return;
      }

      // instance of transaction builder
      let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
      // original amount of satoshis in vin

      let originalAmount = result[0].satoshis;

      // index of vout
      let vout = result[0].vout;

      // txid of vout
      let txid = result[0].txid;

      // add input with txid and index of vout
      transactionBuilder.addInput(txid, vout);

      // get byte count to calculate fee. paying 1 sat/byte
      let byteCount = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 });
      // 192

      // amount to send to receiver. It's the original amount - 1 sat/byte for tx size
      let sendAmount = originalAmount - byteCount;

      // add output w/ address and amount to send
      transactionBuilder.addOutput(cashAddress, sendAmount);

      // keypair
      let keyPair = BITBOX.HDNode.toKeyPair(change);

      // sign w/ HDNode
      let redeemScript;
      transactionBuilder.sign(0, keyPair, redeemScript, transactionBuilder.hashTypes.SIGHASH_ALL, originalAmount);

      // build tx
      let tx = transactionBuilder.build();
      // output rawhex
      this.hex = tx.toHex();

      // sendRawTransaction to running BCH node
      BITBOX.RawTransactions.sendRawTransaction(this.hex).then((result) => {
        this.txid = result;
      }, (err) => {
        console.log(err);
      });
    }, (err) => {
      console.log(err);
    });
    for(let i = 0; i < 10; i++) {
      let account = masterHDNode.derivePath("m/44'/145'/0'/0/" + i);
      this.addresses.push("m/44'/145'/0'/0/" + i + ": " + BITBOX.HDNode.toCashAddress(account));
    }
  }
}
