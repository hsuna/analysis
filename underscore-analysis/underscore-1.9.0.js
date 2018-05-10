//     Underscore.js 1.9.0
//     http://underscorejs.org
//     (c) 2009-2018 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` (`self`) in the browser, `global`
  // on the server, or `this` in some virtual machines. We use `self`
  // instead of `window` for `WebWorker` support.

  // 建立根对象，
  // 浏览器的window，或者服务端的global
  // 使用self代替window
  // 在微信小程序中,self和global都是undefined，使用{}
  var root = typeof self == 'object' && self.self === self && self ||
            typeof global == 'object' && global.global === global && global ||
            this ||
            {};

  // Save the previous value of the `_` variable.
  // 保存'_'变量之前的值，后面noConflict会使用
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  // 保存常用对象的原型链，减少了对象成员的访问深度，避免了冗长的代码书写
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;
  var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

  // Create quick reference variables for speed access to core prototypes.
  // 同上，保存对象原型链上的方法
  var push = ArrayProto.push,
      slice = ArrayProto.slice,
      toString = ObjProto.toString,
      hasOwnProperty = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  // ES5提供的方法，后面会进行判断，优先使用
  var nativeIsArray = Array.isArray,
      nativeKeys = Object.keys,
      nativeCreate = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  // 一个空的构造函数，用于后面的扩展使用
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  // 创建一个underscore对象，不重复创建
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for their old module API. If we're in
  // the browser, add `_` as a global object.
  // (`nodeType` is checked to ensure that `module`
  // and `exports` are not HTML elements.)
  // 模块挂载，如果是node，则将其挂载在module，否则，挂载在全局变量
  if (typeof exports != 'undefined' && !exports.nodeType) {
    if (typeof module != 'undefined' && !module.nodeType && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  // 当前版本号
  _.VERSION = '1.9.0';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  /**
   * 优化回调
   * 使用call比起apply的性能会好，因为apply运行前要对作为参数的数组进行一系列检验和深拷贝
   * apply性能问题：https://segmentfault.com/q/1010000007894513
   * @param func 需优化函数
   * @param context 函数的上下文
   * @param argCount 参数的数量
   */
  var optimizeCb = function(func, context, argCount) {
    // 使用void 0 代替 undefined
    // 一是防止undefined被变量化，另一是减少字符数量，其实0.._或0[0]也可以
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      // The 2-argument case is omitted because we’re not using it.
      // 两个参数的情况没用到，所以这里就没添加
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  var builtinIteratee;

  // An internal function to generate callbacks that can be applied to each
  // element in a collection, returning the desired result — either `identity`,
  // an arbitrary callback, a property matcher, or a property accessor.
  /**
   * 根据value来区分迭代过程并生成一个回调函数，应用在每个元素上
   * @param value 迭代器
   * @param context 函数的上下文
   * @param argCount 参数的数量
   */
  var cb = function(value, context, argCount) {
    // 如果被重写，则调用重写的iteratee
    if (_.iteratee !== builtinIteratee) return _.iteratee(value, context);
    // 如果value为空，使用自身函数
    if (value == null) return _.identity;
    // 如果value为function ，则优化函数
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    // 如果value为对象，进行匹配对象
    if (_.isObject(value) && !_.isArray(value)) return _.matcher(value);
    // 否则返回,属性获取
    return _.property(value);
  };

  // External wrapper for our callback generator. Users may customize
  // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
  // This abstraction hides the internal-only argCount argument.
  /**
   * 外部可以通过重写_.iteratee，进行对迭代器内部进行修改
   * @param value 迭代器
   * @param context 函数的上下文
   */
  _.iteratee = builtinIteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // Some functions take a variable number of arguments, or a few expected
  // arguments at the beginning and then a variable number of values to operate
  // on. This helper accumulates all remaining arguments past the function’s
  // argument length (or an explicit `startIndex`), into an array that becomes
  // the last argument. Similar to ES6’s "rest parameter".
  /**
   * 类似ES6的rest参数的作用，将函数的参数转化为数组
   * let func = (a, b, c) => {console.log(a, b, c)}
   * let rest = restArguments(func);
   * rest(1,2,3,4,5) // 1, 2, [3, 4, 5]
   * @param func rest函数
   * @param startIndex rest开始长度
   */
  var restArguments = function(func, startIndex) {
    //func.length 表示函数定义长度，最后一个转化成rest
    startIndex = startIndex == null ? func.length - 1 : +startIndex;
    return function() {
      // arguments.length 实际传参数长度
      // 如果rest的startIndex大于实际传参长度，则没有rest参数
      var length = Math.max(arguments.length - startIndex, 0),
          rest = Array(length),
          index = 0;
      for (; index < length; index++) {
        rest[index] = arguments[index + startIndex];
      }
      // 函数回调优化
      switch (startIndex) {
        case 0: return func.call(this, rest);
        case 1: return func.call(this, arguments[0], rest);
        case 2: return func.call(this, arguments[0], arguments[1], rest);
      }
      var args = Array(startIndex + 1);
      //普通参数
      for (index = 0; index < startIndex; index++) {
        args[index] = arguments[index];
      }
      //转化成rest的参数
      args[startIndex] = rest;
      return func.apply(this, args);
    };
  };

  // An internal function for creating a new object that inherits from another.
  /**
   * 创建一个继承原型链的函数
   * @param 原型链
   */ 
  var baseCreate = function(prototype) {
    //如果prototype不存在
    if (!_.isObject(prototype)) return {};
    // ES5 Object.create
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  /**
   * 属性获取函数，以及safe，not-null
   * shallowProperty(prop) 可替代 obj => obj.prop
   * @param key 对象属性key
   */
  var shallowProperty = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  /** 
   * 深度属性获取，safe，not-null
   * deepGet({a:{b:{c:1}}}, ['a', 'b', 'c']) -> 1
   * deepGet({a:{b:{c:1}}}, ['a', 'c', 'b']) -> undefined //not-null
   * @param obj 获取对象
   * @param path 对象属性数组
   */
  var deepGet = function(obj, path) {
    var length = path.length;
    for (var i = 0; i < length; i++) {
      if (obj == null) return void 0;
      obj = obj[path[i]];
    }
    return length ? obj : void 0;
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object.
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  
  // JavaScript 中能精确表示的最大的整数
  // https://www.zhihu.com/question/24423421
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  
  // 获取长度方法
  var getLength = shallowProperty('length');

  /**
   * 判断是否伪数组
   * @param collection 判断的对象
   */ 
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  /**
   * 循环迭代
   * @param obj 迭代对象
   * @param iteratee 迭代器
   * @param context 函数上下文
   */
  _.each = _.forEach = function(obj, iteratee, context) {
    // 这里使用optimizeCb，而不是cb是因为需要使用each是为了循环，而非处理数据
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    //伪数组
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      //可迭代的object
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    //返回原迭代对象
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  /**
   * 循环迭代器，处理数据
   * @param obj 迭代对象
   * @param iteratee 迭代器
   * @param context 函数上下文
   */
  _.map = _.collect = function(obj, iteratee, context) {
    // 这里使用cb循环迭代器处理数据
    iteratee = cb(iteratee, context);
    // 如果是伪数组，则keys为false，否则为属性数组
    var keys = !isArrayLike(obj) && _.keys(obj),
    // 获取伪数组的长度，或者属性数组的长度
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    //返回迭代结果
    return results;
  };

  // Create a reducing function iterating left or right.
  /**
   * 一个递衰的迭代器
   * @param dir -1：向左迭代，1：向右迭代
   * dir = -1 -> _.reduce       向左递减 
   * dir =  1 -> _.reduceRight  向右递减 
   */
  var createReduce = function(dir) {
    // Wrap code that reassigns argument variables in a separate function than
    // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
    var reducer = function(obj, iteratee, memo, initial) {
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      if (!initial) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      // 返回迭代，下次迭代调用
      return memo;
    };

    return function(obj, iteratee, memo, context) {
      var initial = arguments.length >= 3;
      return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
    };
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  /**
   * ES5 Array.prototype.reduce
   * @param obj 迭代对象
   * @param iteratee 迭代器
   * @param memo 备忘录
   * @param initial 是否初始化
   */
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  /**
   * ES5 Array.prototype.reduceRight
   * @param obj 迭代对象
   * @param iteratee 迭代器
   * @param memo 备忘录
   * @param initial 是否初始化
   */
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  /**
   * 通过匹配条件进行查找元素
   * @param obj 对象
   * @param predicate 匹配器
   * @param context 函数上下文
   * @return 这里返回的是匹配到的值，而非索引或者键
   */
  _.find = _.detect = function(obj, predicate, context) {
    // 判断是否伪数组，如果是，则用数组索引查找的方法，否则返回对象关键字的方法
    var keyFinder = isArrayLike(obj) ? _.findIndex : _.findKey;
    var key = keyFinder(obj, predicate, context);
    // 如果key存在，则返回对应的值
    if (key !== void 0 && key !== -1) return obj[key];
    // 否则返回`undefinded`
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  /**
   * 通过匹配条件进行过滤元素
   * @param obj 对象
   * @param predicate 匹配器
   * @param context 函数上下文
   * @return 返回过滤数组
   */
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    // 循环对象
    _.each(obj, function(value, index, list) {
      // 过滤匹配
      if (predicate(value, index, list)) results.push(value);
    });
    // 返回匹配数组
    return results;
  };

  // Return all the elements for which a truth test fails.
  /**
   * 通过匹配条件进行排除元素
   * @param obj 对象
   * @param predicate 匹配器
   * @param context 函数上下文
   * @return 返回筛选数组
   */
  _.reject = function(obj, predicate, context) {
    // 和匹配数组一样，但是_.negate返回的是一个相反的判断
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  /**
   * 类ES5 Array.prototype.every
   * 判定所有元素是否匹配条件，如果有一个不匹配，则返回false
   * @param obj 对象
   * @param predicate 匹配器
   * @param context 函数上下文
   * @return {boolean}
   */
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // 如果发现一个不匹配，直接return，就不往下遍历了
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  /**
   * 类ES5 Array.prototype.some
   * 判定是否有一个元素匹配条件的，如果有，则返回true
   * @param obj 对象
   * @param predicate 匹配器
   * @param context 函数上下文
   * @return {boolean}
   */
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      // 如果发现一个匹配，直接return，就不往下遍历了
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  /**
   * 判定数组或者对象是否存在指定元素
   * @param obj 对象列表
   * @param item 匹配对象
   * @param fromIndex 查找位置
   * @param guard 
   * @return {boolean}
   */
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    // 如果为非对象，则将值列表收取出来作为对象列表
    if (!isArrayLike(obj)) obj = _.values(obj);
    // guard是个保护值，感觉没啥用滴？
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    // 如果返回不是-1 则说明存在
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  /**
   * 遍历对象中的每个元素都调用一个函数
  // 返回调用后的结果（数组或者关联数组）
   * @param obj 对象列表
   * @param path 这里可以传入一个对象的函数或者是函数名
   * @param args path函数的参数
   * @return { array } 调用结果
   */
  _.invoke = restArguments(function(obj, path, args) {
    var contextPath, func;
    // 如果path是个function，则直接使用
    if (_.isFunction(path)) {
      func = path;
      // 如果是个数组，则表示对象函数
    } else if (_.isArray(path)) {
      // 函数的上下文
      contextPath = path.slice(0, -1);
      // 函数名
      path = path[path.length - 1];
    }
    // 闭包，优化函数
    return _.map(obj, function(context) {
      var method = func;
      if (!method) {
        // 通过深度获取，获取函数的上下文，
        // 这里之所以获取函数的上下文，是为了传入后面的回调
        if (contextPath && contextPath.length) {
          context = deepGet(context, contextPath);
        }
        if (context == null) return void 0;
        // 如果存在该上下文，则返回方法
        method = context[path];
      }
      // 如果存在方法，则返回回调值，否则为null
      return method == null ? method : method.apply(context, args);
    });
  });

  // Convenience version of a common use case of `map`: fetching a property.
  /**
   * 遍历对象中的每个元素返回对应属性值
   * @param obj 遍历对象
   * @param key 属性值
   * @return { array } 属性列表
   */
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  /**
   * 遍历对象返回匹配的键对值
   * @param obj 遍历对象
   * @param attrs 键对值
   * @return { array } 键对列表
   */
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  /**
   * 遍历对象返回一个匹配的键对值
   * @param obj 遍历对象
   * @param attrs 键对值
   * @return { array } 键对列表
   */
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  /**
   * 遍历对象返回最大的元素
   * @param obj 遍历对象
   * @param [iteratee] 迭代器 如果有迭代器，则比较迭代后的值
   * @param [context] 上下文
   */
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
        // 如果迭代器为空，则直接比较对象的值
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value > result) {
          result = value;
        }
      }
    } else {
      // 否则，则比较迭代后的值
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  /**
   * 遍历对象返回最小的元素
   * @param obj 遍历对象
   * @param [iteratee] 迭代器 如果有迭代器，则比较迭代后的值
   * @param [context] 上下文
   */
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
        // 如果迭代器为空，则直接比较对象的值
    if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value != null && value < result) {
          result = value;
        }
      }
    } else {
      // 否则，则比较迭代后的值
      iteratee = cb(iteratee, context);
      _.each(obj, function(v, index, list) {
        computed = iteratee(v, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = v;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection.
  /**
   * 获取一个乱序的数组
   * @param {*} obj 可遍历对象
   */
  _.shuffle = function(obj) {
    return _.sample(obj, Infinity);
  };

  // Sample **n** random values from a collection using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  /**
   * 获取一个乱序的数组
   * @param obj 可遍历对象，如果不是伪数组，则返回对象的values
   * @param n 数组长度
   * @param guard 保护值
   * @return 返回打乱后的数组
   */
  _.sample = function(obj, n, guard) {
    // 随机返回一个元素
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    var sample = isArrayLike(obj) ? _.clone(obj) : _.values(obj);
    var length = getLength(sample);
    // 获取打乱的长度
    n = Math.max(Math.min(n, length), 0);
    var last = length - 1;
    // 打乱数组，交换位置
    for (var index = 0; index < n; index++) {
      var rand = _.random(index, last);
      var temp = sample[index];
      sample[index] = sample[rand];
      sample[rand] = temp;
    }
    // 返回打乱后的数组
    return sample.slice(0, n);
  };

  // Sort the object's values by a criterion produced by an iteratee.
  /**
   * 通过迭代器排序对象
   * @param {*} obj 遍历对象
   * @param {*} iteratee 迭代器
   * @param {*} context 函数上下文
   */
  _.sortBy = function(obj, iteratee, context) {
    var index = 0;
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, key, list) {
      return {
        value: value,
        index: index++,
        //元素进行迭代返回值，进行排序比较
        criteria: iteratee(value, key, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  /**
   * 将对象进行分组
   * @param {*} behavior 分组规则
   * @param {*} partition 是否分类
   */
  var group = function(behavior, partition) {
    return function(obj, iteratee, context) {
      //如果是分类，则只存在两种，类型，这里就使用数组装载，否则使用对象
      var result = partition ? [[], []] : {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        // 通过迭代器，获取分组的key
        var key = iteratee(value, index, obj);
        //按照key进行分组
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  /**
   * 根据规则将对象进行分组列表
   */
  _.groupBy = group(function(result, value, key) {
    //如果不存在key，则新实例一个数组
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
   /**
   * 根据规则将对象进行分组，这个具有覆盖性
   * 后面的元素会覆盖前面的元素
   */
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  /**
   * 根据规则将对象进行分组统计
   */
  _.countBy = group(function(result, value, key) {
    //如果不存在key，则新实例一个数组，数量为1
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  /**
   * [^\ud800-\udfff]  表示不包含代理对代码点的所有字符
   * [\ud800-\udbff][\udc00-\udfff]  表示合法的代理对的所有字符
   * [\ud800-\udfff]  表示代理对的代码点（本身不是合法的Unicode字符）
   */
  var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
  // Safely create a real, live array from anything iterable.
  /**
   * 将对象，伪数组，字段，转化成数组
   * @param {*} obj 
   */
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (_.isString(obj)) {
      // Keep surrogate pair characters together
      // 将代理对字符放在一起
      return obj.match(reStrSymbol);
    }
    //伪数组返回本身
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    // 对象返回键值列表
    return _.values(obj);
  };

  // Return the number of elements in an object.
  /**
   * 获取对象长度
   * @param {*} obj 遍历对象
   */
  _.size = function(obj) {
    if (obj == null) return 0;
    // 如果是伪数组，则返回数组长度，否则返回键值对的数量
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
    /**
   * 根据规则将对象进行分类
   * 只存在非A既B，迭代器通过boolean进行分类
   */
  _.partition = group(function(result, value, pass) {
    result[pass ? 0 : 1].push(value);
  }, true);

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  /**
   * 返回数组第一个元素，如果存在n,则返回前n个
   */
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null || array.length < 1) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  /**
   * 返回数组，剔除掉最后一个元素，如果存在n,则剔除最后n个
   * @param {*} array 伪数组
   * @param {*} n 数量
   * @param {*} guard 保持值
   */
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  /**
   * 返回数组最后一个元素，如果存在n，则返回最n个
   */
  _.last = function(array, n, guard) {
    if (array == null || array.length < 1) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
    /**
   * 返回数组，剔除掉第一个元素，如果存在n,则剔除n个
   * @param {*} array 伪数组
   * @param {*} n 数量
   * @param {*} guard 保持值
   */
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  /**
   * 过滤掉所有为空的值，包括0, false, '', NaN, null, undefined
   * @param {*} array 
   */
  _.compact = function(array) {
    return _.filter(array, Boolean);
  };

  // Internal implementation of a recursive `flatten` function.
  /**
   * 将数组进行降维，既减多维降低成一维
   * @param {*} input 降维数组
   * @param {*} shallow 是否浅度降维(降低一维)
   * @param {*} strict 
   * @param {*} output 降维队列
   */
  var flatten = function(input, shallow, strict, output) {
    output = output || [];
    var idx = output.length;
    for (var i = 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      // 如果是伪数组，就进行降维
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        // Flatten current level of array or arguments object.
        // 如果是浅度，则直接解维，否则递归
        if (shallow) {
          var j = 0, len = value.length;
          while (j < len) output[idx++] = value[j++];
        } else {
          flatten(value, shallow, strict, output);
          idx = output.length;
        }
        // strict应该要配合shallow用的，舍弃掉第一维的数据
        // [1, [2, 3], [4, [5]]] -> [2, 3, 4, [5]]
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  /**
   * 将数组进行降维，既减多维降低成一维
   */
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  /**
   * 跟_.difference类是，只是传参方式不同
   * @param {rest|number} otherArrays
   * ([1,2], 2, 3, 3, 4) -> [1]
   */
  _.without = restArguments(function(array, otherArrays) {
    return _.difference(array, otherArrays);
  });

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // The faster algorithm will not work with an iteratee if the iteratee
  // is not a one-to-one function, so providing an iteratee will disable
  // the faster algorithm.
  // Aliased as `unique`.
  /**
   * 数组去重
   * @param {*} array 数组
   * @param {*} isSorted 是否排序
   * @param {*} iteratee 迭代器
   * @param {*} context 函数的上下文
   */
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
        //如果是顺序数组，且不存在迭代器
      if (isSorted && !iteratee) {
        // 如果是第一个，或者与上一个不相同，则添加入result
        if (!i || seen !== computed) result.push(value);
        // seen记录上一个值
        seen = computed;
      } else if (iteratee) {
        // 如果seen中不存在，computed，则添加入result，且seen记录已经存在的值
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
        // 如果result中不存在，computed，则添加入result
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  /**
   * 获取多数组的并集
   * @param {rest} 
   */
  _.union = restArguments(function(arrays) {
    //flatten将arrays的二维数组降维成一维数组，再去重
    return _.uniq(flatten(arrays, true, true));
  });

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  /**
   * 获取多数组的交集
   * @param {*} array
   * ([1,2,3,5], [3,4,5,8],[1,3,5,7]) -> [3,5]
   */
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      //如果已经存在，则跳过，这里也有去重的用意
      if (_.contains(result, item)) continue;
      var j;
      for (j = 1; j < argsLength; j++) {
        //如果其他数组不包含该数据，则跳出循环
        if (!_.contains(arguments[j], item)) break;
      }
      //校验了所有数组都包含该数据，则添加该数值
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  /**
   * 获取数组的补集，array的补集
   * @param {rest|array} rest 
   * ([1,2], [2,3], [3,4]) -> [1]
   * 话说这里如果array本身存在重复数据的话，好像也不去重
   */
  _.difference = restArguments(function(array, rest) {
    //flatten将arrays的二维数组降维成一维数组
    rest = flatten(rest, true, true);
    //过滤掉其他数组存在的数值
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  });

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices.
  /** 
   * 将每个数组同位置的值合并成一个
   * [[1,2,3], ['a','b','c'], [true, false, true]] -> [{1, 'a', true}, {2, 'b', false}, {3, 'c', true}]
   * @param array
   */
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      //同位置数组合并成对象
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  /**
   * 以rest的形式传入
   * ([1,2,3], ['a','b','c'], [true, false, true]) -> [{1, 'a', true}, {2, 'b', false}, {3, 'c', true}]
   */
  _.zip = restArguments(_.unzip);

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values. Passing by pairs is the reverse of _.pairs.
  /**
   * 将数组转换为对象
   * @param list 
   * @param values 
   * @returns {object}
   */
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        //如果存在value, 则list=[ key ], values = [value]
        result[list[i]] = values[i];
      } else {
        //否则，list = [[key, value]]
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions.
  /**
   * 闭包
   * @param dir 
   * dir =  1 -> 正向查找
   * dir = -1 -> 反向查找
   */
  var createPredicateIndexFinder = function(dir) {
    /**
     * @param array 数组
     * @param predicate 匹配器
     * @param context 上下文
     */
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      // 根据方向，判定是从开始，还是末尾查找
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        // 如果判定成功，则返回匹配到的索引
        if (predicate(array[index], index, array)) return index;
      }
      //否则返回-1
      return -1;
    };
  };

  // Returns the first index on an array-like that passes a predicate test.
  /**
   * 正向找到数组中匹配的元素，返回索引
   */
  _.findIndex = createPredicateIndexFinder(1);
  /**
   * 反向找到数组中匹配的元素，返回索引
   */
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  /**
   * 有序数组二分查找
   * @param array 查找的数组
   * @param obj 匹配的对象
   * @param iteratee 匹配器
   * @param context 函数上下文
   */
  _.sortedIndex = function(array, obj, iteratee, context) {
    //如果iteratee为空，则返回自身
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      //判定中间数，进行折中的筛选
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions.
  /**
   * indexOf和lastIndexOf的函数生成器
   * @param dir 查找方向
   * dir =  1 -> 正向查找
   * dir = -1 -> 反向查找
   * @param predicateFind 
   * @param sortedIndex 二分查找，性能优化
   */
  var createIndexFinder = function(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      // 如果idx是数值，则表示查找位置
      if (typeof idx == 'number') {
        // 修改查找位置
        if (dir > 0) {
          // 正向
          i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
          // 反向
          length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
        // 如果是有序列表，则使用二分查找
        // idx是个非数值的判定值，表示数组是否有序，
        // 如果非有序数组，却使用了true，那就有可能会出错，
        // 这里是外部调用是进行优化的，并没有容错性
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        // 如果没找到，则返回-1
        return array[idx] === item ? idx : -1;
      }
      // 这里看了好久，一直没主要下面的NaN，用于判断item是否NaN
      if (item !== item) {
        // 如果是，则查找出第一个NaN的位置
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        // 进行判断位置是否相等
        return idx >= 0 ? idx + i : -1;
      }
      // 遍历查找
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  };

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  // 正向查找
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  // 反向查找
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  /**
   * 创建一个规律的整数列表
   * @param start 开始值
   * @param stop 结束值
   * @param step 增值
   */
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    if (!step) {
      //如果stop < start 则表示负增长
      step = stop < start ? -1 : 1;
    }

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Chunk a single array into multiple arrays, each containing `count` or fewer
  // items.
  /**
   * 将单个数组转成多个数组
   * @param {*} array 
   * @param {*} count 每个数组的程度
   * @example ([1,2,3,4,5], 2) -> [[1,2], [3,4], [5]]
   */
  _.chunk = function(array, count) {
    if (count == null || count < 1) return [];
    var result = [];
    var i = 0, length = array.length;
    while (i < length) {
      result.push(slice.call(array, i, i += count));
    }
    return result;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments.
  /**
   * 执行一个函数作为构造函数或者是带参数的不同函数
   * @param sourceFunc 原函数
   * @param boundFunc 绑定后的函数
   * @param context 绑定的上下文
   * @param callingContext 调用上下文
   * @param args 参数
   * @returns {*}
   */
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    //
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  /**
   * 函数绑定，类是ES5的Function.bind
   */
  _.bind = restArguments(function(func, context, args) {
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var bound = restArguments(function(callArgs) {
      return executeBound(func, bound, context, this, args.concat(callArgs));
    });
    return bound;
  });

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder by default, allowing any combination of arguments to be
  // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
  _.partial = restArguments(function(func, boundArgs) {
    var placeholder = _.partial.placeholder;
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  });

  _.partial.placeholder = _;

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = restArguments(function(obj, keys) {
    keys = flatten(keys, false, false);
    var index = keys.length;
    if (index < 1) throw new Error('bindAll must be passed function names');
    while (index--) {
      var key = keys[index];
      obj[key] = _.bind(obj[key], obj);
    }
  });

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = restArguments(function(func, wait, args) {
    return setTimeout(function() {
      return func.apply(null, args);
    }, wait);
  });

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var timeout, context, args, result;
    var previous = 0;
    if (!options) options = {};

    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };

    var throttled = function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };

    throttled.cancel = function() {
      clearTimeout(timeout);
      previous = 0;
      timeout = context = args = null;
    };

    return throttled;
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, result;

    var later = function(context, args) {
      timeout = null;
      if (args) result = func.apply(context, args);
    };

    var debounced = restArguments(function(args) {
      if (timeout) clearTimeout(timeout);
      if (immediate) {
        var callNow = !timeout;
        timeout = setTimeout(later, wait);
        if (callNow) result = func.apply(this, args);
      } else {
        timeout = _.delay(later, wait, this, args);
      }

      return result;
    });

    debounced.cancel = function() {
      clearTimeout(timeout);
      timeout = null;
    };

    return debounced;
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  // 返回一个相反的判定
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  _.restArguments = restArguments;

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  /** 实现'for in'的功能 */
  // 浏览器兼容判定
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  // 不可枚举属性
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
    'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  //添加不可枚举的属性
  var collectNonEnumProps = function(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = _.isFunction(constructor) && constructor.prototype || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    //将属性添加到原有的keys
    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  };

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`.
  /**
   * 获取Object所有可枚举的属性
   * 类似ES5的Object.keys
   * @param {*} obj 
   */
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  /**
   * 获取Object所有的属性
   * @param {*} obj 
   */
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  /**
   * 获取Object所有可枚举的属性值
   * @param {*} obj 
   */
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object.
  // In contrast to _.map it returns an object.
  /**
   * 将对象的每个属性进行转换
   * @param {*} obj 
   * @param {*} iteratee 
   * @param {*} context 
   */
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = _.keys(obj),
        length = keys.length,
        results = {};
    for (var index = 0; index < length; index++) {
      var currentKey = keys[index];
      //获取新的值
      results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  // The opposite of _.object.
  /**
   * 将一个对象转化成数组形式：[key, value]
   * @param {*} obj 
   */
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  /**
   * 将一个对象的key和value调换：obj[value] = key
   * @param {*} obj 
   */
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`.
  /**
   * 获取一个对象里的所有方法, 并进行排序
   * @param {*} obj 
   */
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, defaults) {
    return function(obj) {
      var length = arguments.length;
      if (defaults) obj = Object(obj);
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!defaults || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s).
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test.
  /**
   * 查找匹配对象，返回key
   * @param obj  查找对象
   * @param predicate 匹配器
   * @param context 上下文
   */
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    // 获取key列表
    var keys = _.keys(obj), key;
    // 遍历keys
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      //如果匹配 则返回该key
      if (predicate(obj[key], key, obj)) return key;
    }
    //没有匹配成功，返回undefined
  };

  // Internal pick helper function to determine if `obj` has key `key`.
  /**
   * 判断key是否为对象的属性，这里将其写成一个迭代器
   * @param value 
   * @param key 
   * @param obj 
   */
  var keyInObj = function(value, key, obj) {
    return key in obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = restArguments(function(obj, keys) {
    var result = {}, iteratee = keys[0];
    if (obj == null) return result;
    if (_.isFunction(iteratee)) {
      if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
      keys = _.allKeys(obj);
    } else {
      iteratee = keyInObj;
      keys = flatten(keys, false, false);
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  });

  // Return a copy of the object without the blacklisted properties.
  _.omit = restArguments(function(obj, keys) {
    var iteratee = keys[0], context;
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
      if (keys.length > 1) context = keys[1];
    } else {
      keys = _.map(flatten(keys, false, false), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  });

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq, deepEq;
  eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // `null` or `undefined` only equal to itself (strict comparison).
    if (a == null || b == null) return false;
    // `NaN`s are equivalent, but non-reflexive.
    if (a !== a) return b !== b;
    // Exhaust primitive checks
    var type = typeof a;
    if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
    return deepEq(a, b, aStack, bStack);
  };

  // Internal recursive comparison function for `isEqual`.
  deepEq = function(a, b, aStack, bStack) {
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN.
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
      case '[object Symbol]':
        return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError, isMap, isWeakMap, isSet, isWeakSet.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error', 'Symbol', 'Map', 'WeakMap', 'Set', 'WeakSet'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
  var nodelist = root.document && root.document.childNodes;
  if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return !_.isSymbol(obj) && isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, path) {
    if (!_.isArray(path)) {
      return obj != null && hasOwnProperty.call(obj, path);
    }
    var length = path.length;
    for (var i = 0; i < length; i++) {
      var key = path[i];
      if (obj == null || !hasOwnProperty.call(obj, key)) {
        return false;
      }
      obj = obj[key];
    }
    return !!length;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  // 默认迭代器：返回自身函数
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  /**
   * 使用函数的方式表示变量
   */
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  /**
   * 空方法，防止建立太多的方法
   */
  _.noop = function(){};

  // Creates a function that, when passed an object, will traverse that object’s
  // properties down the given `path`, specified as an array of keys or indexes.
  _.property = function(path) {
    if (!_.isArray(path)) {
      return shallowProperty(path);
    }
    return function(obj) {
      return deepGet(obj, path);
    };
  };

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    if (obj == null) {
      return function(){};
    }
    return function(path) {
      return !_.isArray(path) ? obj[path] : deepGet(obj, path);
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  /**
   * 获取最新的时间
   */
  _.now = Date.now || function() {
    return new Date().getTime();
  };

  // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped.
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // Traverses the children of `obj` along `path`. If a child is a function, it
  // is invoked with its parent as context. Returns the value of the final
  // child, or `fallback` if any child is undefined.
  _.result = function(obj, path, fallback) {
    if (!_.isArray(path)) path = [path];
    var length = path.length;
    if (!length) {
      return _.isFunction(fallback) ? fallback.call(obj) : fallback;
    }
    for (var i = 0; i < length; i++) {
      var prop = obj == null ? void 0 : obj[path[i]];
      if (prop === void 0) {
        prop = fallback;
        i = length; // Ensure we don't continue iterating.
      }
      obj = _.isFunction(prop) ? prop.call(obj) : prop;
    }
    return obj;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate: /<%([\s\S]+?)%>/g,
    interpolate: /<%=([\s\S]+?)%>/g,
    escape: /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'": "'",
    '\\': '\\',
    '\r': 'r',
    '\n': 'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offset.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    var render;
    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var chainResult = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return chainResult(this, func.apply(_, args));
      };
    });
    return _;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return chainResult(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return chainResult(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return String(this._wrapped);
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define == 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}());
