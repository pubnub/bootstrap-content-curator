(function(){

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// SYNC
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.sync = function( name, settings ) {
    //var pubnub       = PUBNUB.secure(settings)
    var pubnub       = PUBNUB.init(settings)
    ,   db           = storage().get('db-'+name)      || {}
    ,   tranlog      = storage().get('tranlog-'+name) || {}
    ,   binlog       = storage().get('binlog-'+name)  || []
    ,   last         = +storage().get('last-'+name)   || 0
    ,   transmitting = false
    ,   oncreate     = function() {}
    ,   onupdate     = function() {}
    ,   ondelete     = function() {}
    ,   self         = function() { return db };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // BINDING EVENTS FOR USER
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.on = {
        create : function(cb) { oncreate = cb }
    ,   update : function(cb) { onupdate = cb }
    ,   delete : function(cb) { ondelete = cb }
    };

    // TODO - 
    // TODO - replay log from oldest known to newest as they come in
    // TODO - .on() events
    // TODO - subscribe backfill with prevent duplicate events
    // TODO - 

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // SYNC DB
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    sync_binlog({
        net      : pubnub
    ,   channel  : name
    ,   limit    : settings.limit
    ,   start    : last
    ,   callback : function( evts, timetoken ) {
            pubnub.subscribe({
                backfill  : true
            ,   channel   : name
            ,   message   : receiver
            });
        }
    ,   progress : function( evts, timetoken ) {
            PUBNUB.each( evts, function(evt){ 
                receiver( evt, {}, timetoken );
            } );
        }
    });

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // RECEIVER OF REMOTE SYNC DATA
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    function receiver( evt, _, timetoken ) {
        storage().set( 'last-'+name, +timetoken - 80000000 );
    }

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // CREATE
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.create = function(data) {
        var id = execute( 'create', data );
        db[id] = data;
        var ref = reference(id);

        // Save Local DB
        storage().set( 'db-'+name, db );

        oncreate(ref);

        return ref;
    };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // READ
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.read = function(id) {
        return reference(id);
    };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // UPDATE
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.update = function( id, data ) {
        execute( 'update', merge( db[id], data ), id );
    };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // DELETE
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.delete = function(id) {
        execute( 'delete', {}, id );
        delete db[id];
    };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // DELETE_ALL
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    self.delete_all = function() {
        PUBNUB.each( db, self.delete );
    };

    // TODO
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // FIND
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    db.find = function(query) {
        var found = [];
        PUBNUB.each( query, function( q_key, q_val ) {
            PUBNUB.each( db, function( db_key, db_val ) {
                //if (key in 
            } );
        } );
    };

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // MAKE REFERENCE OBJECT
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    function reference(id) {
        var ref    = { id : id, data : db[id] };
        ref.delete = function()     { self.delete(id)         };
        ref.update = function(data) { self.update( id, data ) };
        return ref;
    }

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // CREATE, UPDATE, DELETE TRANSACTION MANAGER
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    function execute( command, data, id ) {
        var id     = id || PUBNUB.uuid()
        ,   domain = PUBNUB.uuid();

        // transaction log to prevent firing events twice
        tranlog[domain] = 1;

        binlog.push({
                id      : id
            ,   domain  : domain
            ,   command : command
            ,   data    : data
        });

        storage().set( 'binlog-'+name, binlog );

        commit();

        return id;
    }

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // COMMIT
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    function commit() {
        console.log( '%d untransmitted', binlog.length );
        var transaction = binlog[0];
        if (!transaction || transmitting) return;
        transmitting = true;

        pubnub.publish({
            channel  : name
        ,   message  : transaction
        ,   error    : next_commit
        ,   callback : next_commit
        });
    }

    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    // NEXT COMMIT
    // =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    function next_commit(info) {
        transmitting = false;
        var success = info && info[0];

        setTimeout( commit, success ? 10 : 1000 );
        if (!success) return;

        binlog.shift();
        storage().set( 'binlog-'+name, binlog );
    }

    return self;
};


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// SYNC BINLOG
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function sync_binlog(args) {
    var channel  = args['channel']
    ,   callback = args['callback'] || function(){}
    ,   progress = args['progress'] || function(){}
    ,   limit    = args['limit']    || 5
    ,   start    = args['start']    || 0
    ,   net      = args['net']
    ,   count    = 100
    ,   binlog   = []
    ,   params   = {
        channel  : channel,
        count    : count,
        start    : start,
        reverse  : true,
        callback : receiver
    };

    fetch_binlog();

    function receiver(messages) {
        var msgs     = messages[0];
        start        = messages[2];
        params.start = start;

        PUBNUB.each( msgs.reverse(), function(m) {binlog.push(m)} );

        progress( msgs.reverse(), start );

        // if done then call last user cb
        if ( binlog.length >= limit ||
             msgs.length    < count
        ) return callback( binlog, start );

        fetch_binlog();
    }

    function fetch_binlog() { net.history(params) }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// LOCAL MEMORY STORAGE MERGE
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
var each = PUBNUB.each;
function merge( target, src ) {
    each( src, function (key) {
        if (src[key] == null) { delete target[key]; return; }
        if (typeof src[key] !== 'object' || !src[key]) target[key] = src[key];
        else {
            if (!target[key]) target[key] = src[key]
            else target[key] = merge( target[key], src[key] )
        }
    } );
    return target;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// LOCAL DISK STORAGE
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
function storage() {
    var ls = window['localStorage'];
    return {
        'get' : function(key) {
            try {
                if (ls) return JSON.parse(ls.getItem(key));
            } catch(e) { return }
        },
        'set' : function( key, value ) {
            try {
                if (ls) return ls.setItem( key, JSON.stringify(value) ) && 0;
            } catch(e) { return }
        }
    };
}

})();
