var files = ['app.js', 'store.js', 'auth.js', 'config.js', 'holidays.js'];
for (var i = 0; i < files.length; i++) {
  var src = readFile(files[i]);
  try { new Function(src); print('OK   ' + files[i]); }
  catch (e) { print('NG   ' + files[i] + ' : ' + e); }
}
