// ── Firebase DB Layer ──
// Wraps Firestore + Auth. blog-engine.js calls these functions.
// Data is loaded into memory on init so all reads stay synchronous.

var BensecDB = (function () {
  'use strict';

  var _db   = null;
  var _auth = null;
  var _ready = false;

  // ── In-memory caches ──
  var _posts    = [];
  var _projects = [];
  var _cs       = [];
  var _status   = null;

  // ── Init ──
  function init() {
    if (!window.firebase || !window.FIREBASE_CONFIG) return Promise.resolve(false);
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      _db   = firebase.firestore();
      _auth = firebase.auth();
      _ready = true;
      return loadAll();
    } catch (e) {
      console.warn('Firebase init failed:', e);
      return Promise.resolve(false);
    }
  }

  // ── Load everything from Firestore into memory ──
  function loadAll() {
    var promises = [
      _db.collection('posts').get().then(function (snap) {
        _posts = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      }),
      _db.collection('projects').get().then(function (snap) {
        _projects = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      }),
      _db.collection('config').doc('cheatsheets').get().then(function (doc) {
        _cs = doc.exists ? (doc.data().sections || []) : [];
      }),
      _db.collection('config').doc('status').get().then(function (doc) {
        _status = doc.exists ? doc.data() : null;
      })
    ];
    return Promise.all(promises).then(function () { return true; }).catch(function (e) {
      console.warn('Firebase loadAll failed:', e);
      return false;
    });
  }

  // ── Posts ──
  function getPosts() { return _posts.slice(); }

  function savePosts(posts) {
    _posts = posts;
    if (!_ready) return;
    var batch = _db.batch();
    // Delete all existing post docs, then re-write
    _db.collection('posts').get().then(function (snap) {
      snap.docs.forEach(function (d) { batch.delete(d.ref); });
      posts.forEach(function (p) {
        var ref = _db.collection('posts').doc(p.id);
        batch.set(ref, p);
      });
      return batch.commit();
    }).catch(function (e) { console.warn('savePosts failed:', e); });
  }

  function savePost(post) {
    var idx = _posts.findIndex(function (p) { return p.id === post.id; });
    if (idx !== -1) { _posts[idx] = post; } else { _posts.push(post); }
    if (!_ready) return;
    _db.collection('posts').doc(post.id).set(post).catch(function (e) {
      console.warn('savePost failed:', e);
    });
  }

  function deletePost(id) {
    _posts = _posts.filter(function (p) { return p.id !== id; });
    if (!_ready) return;
    _db.collection('posts').doc(id).delete().catch(function (e) {
      console.warn('deletePost failed:', e);
    });
  }

  // ── Projects ──
  function getProjects() { return _projects.slice(); }

  function saveProjects(projects) {
    _projects = projects;
    if (!_ready) return;
    var batch = _db.batch();
    _db.collection('projects').get().then(function (snap) {
      snap.docs.forEach(function (d) { batch.delete(d.ref); });
      projects.forEach(function (p) {
        var ref = _db.collection('projects').doc(p.id);
        batch.set(ref, p);
      });
      return batch.commit();
    }).catch(function (e) { console.warn('saveProjects failed:', e); });
  }

  // ── Cheatsheets ──
  function getCS() { return _cs.slice(); }

  function saveCS(sections) {
    _cs = sections;
    if (!_ready) return;
    _db.collection('config').doc('cheatsheets').set({ sections: sections }).catch(function (e) {
      console.warn('saveCS failed:', e);
    });
  }

  // ── Status ──
  function getStatus() { return _status; }

  function saveStatus(data) {
    _status = data;
    if (!_ready) return;
    _db.collection('config').doc('status').set(data || {}).catch(function (e) {
      console.warn('saveStatus failed:', e);
    });
  }

  function clearStatus() {
    _status = null;
    if (!_ready) return;
    _db.collection('config').doc('status').delete().catch(function (e) {
      console.warn('clearStatus failed:', e);
    });
  }

  // ── Storage (images) ──
  function uploadImage(blob, filename) {
    if (!_ready || !window.firebase || !firebase.storage) {
      return Promise.reject(new Error('Firebase Storage not available'));
    }
    var storage = firebase.storage();
    var safeName = (filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = 'post-images/' + Date.now() + '_' + safeName;
    var ref = storage.ref(path);
    return ref.put(blob).then(function (snap) {
      return snap.ref.getDownloadURL();
    });
  }

  // ── Auth ──
  function login(password) {
    if (!_ready || !window.ADMIN_EMAIL) return Promise.reject(new Error('Firebase not ready'));
    return _auth.signInWithEmailAndPassword(ADMIN_EMAIL, password);
  }

  function logout() {
    if (!_ready) return Promise.resolve();
    return _auth.signOut();
  }

  function onAuthChange(callback) {
    if (!_ready) { callback(null); return; }
    _auth.onAuthStateChanged(callback);
  }

  function isReady() { return _ready; }

  return {
    init:         init,
    isReady:      isReady,
    getPosts:     getPosts,
    savePosts:    savePosts,
    savePost:     savePost,
    deletePost:   deletePost,
    getProjects:  getProjects,
    saveProjects: saveProjects,
    getCS:        getCS,
    saveCS:       saveCS,
    getStatus:    getStatus,
    saveStatus:   saveStatus,
    clearStatus:  clearStatus,
    login:        login,
    logout:       logout,
    onAuthChange: onAuthChange,
    uploadImage:  uploadImage
  };
}());
