// Debug.Scripts keep their referents alive.

var g = newGlobal('new-compartment');
var dbg = Debug(g);
var arr = [];
dbg.hooks = {debuggerHandler: function (frame) { arr.push(frame.script); }};
g.eval("for (var i = 0; i < 10; i++) Function('debugger;')();");
assertEq(arr.length, 10);

gc();

for (var i = 0; i < arr.length; i++)
    assertEq(arr[i].live, true); // XXX FIXME - replace with something that touches the script

