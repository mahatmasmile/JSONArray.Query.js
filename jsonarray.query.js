/**
 * JSON Array Query Plus v1.2.1
 * 
 * JSONArray.Query('@colname1="test" OR @colname2=999') return [{...},{...},...];
 * JSONArray.Select('@colname1,@colname2,"colname3":@colname1 + "#" + @colname2') return [{colname1:"test",colname2:999,colname3:"test#999"},{...},...];
 * JSONArray.First() return {...};
 * JSONArray.Join('@colname1 + "#" + @colname2', '|') return "test#999|test#999|...";
 * JSONArray.IndexOf('@colname1="test" OR @colname2=999') return -1;
 * JSONArray.Remove('@colname1="test" OR @colname2=999') return [{...},{...},...];
 * JSONArray.OrderBy('@colname1') return [{...},{...},...];
 * JSONArray.OrderByDesc('@colname2') return [{...},{...},...];
 * JSONArray.Each(function(index,item){...});
 * JSONArray.Contains('test'); return true|false;
 * JSONArray.Take(3); return [{...},{...},{...}];
 * JSONArray.Sum('@colname1'); return 64;
 * JSONArray.Sum('@colname1 + @colname1'); return 128;
 * JSONArray.Distinct(); return [{...},{...},...];
 * JSONArray.GroupBy('@colname1,@colname2'); return [{colname1:"test",colename2:999,Data:[{...},...]},{...},...];
 * AND OR <> NOT = > < >= <=
 */
; (function () {
    'use strict'
    var len = function (s) {
        return s.length;
    }
    var left = function (s, n) {
        return s.substr(0, n);
    }
    var right = function (s, n) {
        return s.substr(-n);
    }
    var index = function (s, find) {
        return s.indexOf(find) + 1;
    }
    var _proto = Array.prototype;

    // 自定义变量识别符号，默认@
    var _symbol = '@';

    // 编译后的缓存，提升效率
    var _cache = {};

    // 自定义运算符：JS运算符
    var _alias = [
        RegExp('@', 'g'), '_e.',
        /\sAND\s/gi, " && ",
        /\sOR\s/gi, " || ",
        /<>/g, "!=",
        /NOT/gi, "!",
        /([^+\-*/])\+([^+\-*/]|$)/g, '$1+$2',
        /([^=<>])=([^=]|$)/g, '$1==$2',
        /([^=<>])>([^=]|$)/g, '$1>$2',
        /([^=<>])<([^=]|$)/g, '$1<$2',
        /([^=<>])>=([^=]|$)/g, '$1>=$2',
        /([^=<>])<=([^=]|$)/g, '$1<=$2'
    ];
    var _rQuote = /""/g;
    var _rQuoteTemp = /!~/g;

    // 编译自定义语法
    var _complite = function (code) {
        return eval("0," + code);
    }

    // 将自定义语法转成JS语法
    var _interpret = function (exp) {
        exp = exp.replace(_rQuote, "!~");
        var arr = exp.split('"');
        var i,
            n = arr.length;
        var k = _alias.length;
        for (var i = 0; i < n; i += 2) {
            var s = arr[i];
            for (var j = 0; j < k; j += 2) {
                if (index(s, _alias[j]) > -1) {
                    s = s.replace(_alias[j], _alias[j + 1]);
                }
            }
            arr[i] = s;
        }
        for (var i = 1; i < n; i += 2) {
            arr[i] = arr[i].replace(_rQuoteTemp, '\\"');
        }
        return arr.join('"');
    }

    // 查询模函数
    var _queryTempl = function (_list) {
        var _ret = [];
        var _i = -1;
        for (var _k in _list) {
            var _e = _list[_k];
            if (_e != _proto[_k]) {
                if ($C) {
                    _ret[++_i] = _e;
                }
            }
        }
        return _ret;
    }.toString();

    // 查找元素模函数
    var _indexOfTempl = function (_list) {
        for (var _k in _list) {
            var _e = _list[_k];
            if (_e != _proto[_k]) {
                if ($C) {
                    return _k;
                }
            }
        }
        return -1;
    }.toString();

    // 选择列模函数
    var _selectTempl = function (_list) {
        var _ret = [];
        var _i = -1;
        for (var _k in _list) {
            var _e = _list[_k];
            if (_e != _proto[_k]) {
                _ret[++_i] = $C;
            }
        }
        return _ret;
    }.toString();

    // 拼接字符串模函数
    var _joinTempl = function (_list) {
        var _ret = [];
        var _i = -1;
        for (var _k in _list) {
            var _e = _list[_k];
            if (_e != _proto[_k]) {
                _ret[++_i] = $C;
            }
        }
        return _ret;
    }.toString();

    // 求和模函数
    var _sumTempl = function (_list) {
        var _ret = 0;
        for (var _k in _list) {
            var _e = _list[_k];
            if (_e != _proto[_k]) {
                _ret += $C;
            }
        }
        return _ret;
    }.toString();

    // 分组查询模函数 $C $KEYS
    var _groupByTempl = function (_list) {
        var _map = {},
            _ret = [];
        for (var _i = 0; _i < _list.length; _i++) {
            var _e = _list[_i];
            var _key = $C.join('_');
            var _colnames = $KEYS;
            if (!_map[_key]) {
                var _r = {};
                for (var _k = 0; _k < _colnames.length; _k++) {
                    _r[_colnames[_k]] = _e[_colnames[_k]];
                }
                _r['#key'] = _key;
                _r.Data = [_e];
                _ret.push(_r);
                _map[_key] = true;
            } else {
                for (var _j = 0; _j < _ret.length; _j++) {
                    var _r = _ret[_j];
                    if (_r['#key'] === _key) {
                        _r.Data.push(_e);
                        break;
                    }
                }
            }
        }
        return _ret;
    }.toString();

    // 拼接字符串
    _proto.Join = function (exp, separator) {
        var pr = "Join";
        if (!exp) {
            return [];
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var code = _interpret(exp);
                code = _joinTempl.replace(/\$C/, code);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this).join(separator);
        } catch (e) {
            return [];
        }
    }

    // 选择列
    _proto.Select = function (exp) {
        var pr = "Select";
        if (!exp) {
            return [];
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var _pronameArr = exp.split(',');
                var _addDefaultProname = _pronameArr.length > 1;
                for (var i = 0; i < _pronameArr.length; i++) {
                    if (_addDefaultProname && _pronameArr[i].indexOf(":") <= -1) {
                        _pronameArr[i] = _pronameArr[i].replace(/@/gm, "") + ":" + _pronameArr[i];
                    }
                }
                if (_addDefaultProname) {
                    exp = "{" + _pronameArr.join(',') + "}";
                } else {
                    //只有一个元素
                    if (_pronameArr[0].indexOf(":") > 0) {
                        exp = "{" + _pronameArr[0] + "}";
                    } else {
                        exp = _pronameArr[0];
                    }
                }
                var code = _interpret(exp);
                code = _selectTempl.replace(/\$C/, code);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this);
        } catch (e) {
            return [];
        }
    }

    // 扩展查询的方法
    _proto.Query = function (exp) {
        var pr = "Query";
        if (!exp) {
            return [];
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var code = _interpret(exp);
                code = _queryTempl.replace(/\$C/gm, code);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this);
        } catch (e) {
            return [];
        }
    }

    // 查找元素下标
    _proto.IndexOf = function (exp) {
        var pr = "IndexOf";
        if (!exp) {
            return -1;
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var code = _interpret(exp);
                if (code.indexOf('_e.') < 0) {
                    code = '_e == "{0}"'.replace('{0}', code);
                }
                code = _indexOfTempl.replace(/\$C/gm, code);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this);
        } catch (e) {
            return -1;
        }
    }

    // 求和的方法
    _proto.Sum = function (exp) {
        var pr = "Sum";
        if (!exp) {
            return 0;
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var code = _interpret(exp);
                code = _sumTempl.replace(/\$C/gm, code);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this);
        } catch (e) {
            return 0;
        }
    }

    // 分组查询
    _proto.GroupBy = function (exp) {
        var pr = "GroupBy";
        if (!exp) {
            return [];
        }
        var fn = _cache[pr + exp];
        try {
            if (!fn) {
                var _pronameArr = exp.split(',');
                var _exp = '[' + exp + ']';
                var _keys = '["' + _pronameArr.join('","').replace(/@/gm, '') + '"]';
                _exp = _interpret(_exp);
                var code = _groupByTempl.replace(/\$C/gm, _exp);
                code = code.replace(/\$KEYS/gm, _keys);
                fn = _cache[pr + exp] = _complite(code);
            }
            return fn(this);
        } catch (e) {
            console.log(e);
            return [];
        }
    }

    // 去重
    _proto.Distinct = function () {
        return Array.from(new Set(this));
    }

    // 取数组第一个元素
    _proto.First = function () {
        if (this.length > 0)
            return this[0];
        else
            return {};
    }

    // 删除元素
    _proto.Remove = function (exp) {
        var res = [];
        var index = -1;
        do {
            index = this.IndexOf(exp);
            if (index > -1) {
                res.push(this.splice(index, 1));
            }
        } while (index > -1)
        return res;
    }

    // 返回指定数量的元素
    _proto.Take = function (num) {
        var ret = [];
        for (var i = 0; i < (this.length > num ? num : this.length); i++) {
            ret.push(this[i]);
        }
        return ret;
    }

    // 正序排序
    _proto.OrderBy = function (proname) {
        proname = (proname || '').trim().replace(/@/igm, '');
        return objArrSort(this, proname);
    }

    // 倒序排序
    _proto.OrderByDesc = function (proname) {
        proname = (proname || '').trim().replace(/@/igm, '');
        return objArrSort(this, proname).reverse();
    }

    // 遍历
    _proto.Each = function (callbackFunc) {
        for (var i = 0; i < this.length; i++) {
            callbackFunc(i, this[i]);
        }
    }

    // 是否包含指定元素
    _proto.Contains = function (exp) {
        return this.IndexOf(exp) > -1;
    }

    // 对象数组排序  proname:"排序的字段"
    function objArrSort(objArr, proname) {
        if (!objArr || objArr.length === 0)
            return [];
        if (!proname)
            return objArr;
        var tmpObj = {};
        for (var i = 0; i < objArr.length - 1; i++) {
            for (var c = 0; c < objArr.length - 1 - i; c++) {
                if (objArr[c][proname] > objArr[c + 1][proname]) {
                    tmpObj = objArr[c];
                    objArr[c] = objArr[c + 1];
                    objArr[c + 1] = tmpObj;
                }
            }
        }
        return objArr;
    }
})();
