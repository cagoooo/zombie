import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isNewer} from '../src/version.js';
test('更新版本閘門拒絕同版／舊版／無效版，接受新發布序號及數值版本',()=>{
  const a={version:'1.9.0',id:'a',sequence:8};
  assert.equal(isNewer(a,a),false);
  assert.equal(isNewer({...a,id:'b'},a),false);
  assert.equal(isNewer({...a,id:'b',sequence:9},a),true);
  assert.equal(isNewer({...a,id:'b',sequence:7},a),false);
  assert.equal(isNewer({version:'1.10.0',id:'c',sequence:1},a),true);
  assert.equal(isNewer({version:'1.8.0',id:'c',sequence:99},a),false);
  assert.equal(isNewer(null,a),false);
  assert.equal(isNewer({version:'bad',id:'c'},a),false);
  assert.equal(isNewer(a,null),true);
});
