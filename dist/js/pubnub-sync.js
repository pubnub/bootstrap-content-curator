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
    ,   last         = storage().get('last-'+name)    || 0
    ,   transmitting = false
    ,   oncreate     = function() {}
    ,   onupdate     = function() {}
    ,   ondelete     = function() {}
    ,   self         = function() { return db };

    self.on = {
        create : function(cb) { oncreate = cb }
    ,   update : function(cb) { onupdate = cb }
    ,   delete : function(cb) { ondelete = cb }
    };

    // TODO - 
    // TODO - ensure Full Transmit (NO DIFFs!@!!)
    // TODO - replay log from oldest known to newest as they come in
    // TODO - .on() events
    // TODO - subscribe backfill with prevent duplicate events
    // TODO - 

    sync_binlog({
        net      : pubnub
    ,   channel  : name
    ,   limit    : settings.limit
    ,   start    : last
    ,   progress : function(msgs) {
            // TODO
            console.log(msgs);
        }
    });

    // create
    self.create = function(data) {
        var id = execute( 'create', data );
        db[id] = data;
        var ref = reference(id);

        // Save Local DB
        storage().set( 'db-'+name, db );

        oncreate(ref);

        return ref;
    };

    // read
    self.read = function(id) {
        return reference(id);
    };

    // update
    self.update = function( id, data ) {
        execute( 'update', merge( db[id], data ), id );
    };

    // delete
    self.delete = function(id) {
        execute( 'delete', {}, id );
        delete db[id];
    };

    // make reference object
    function reference(id) {
        var ref    = { id : id, data : db[id] };
        ref.delete = function()     { self.delete(id)         };
        ref.update = function(data) { self.update( id, data ) };
        return ref;
    }

    // create, update, delete transaction manager
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

        transmit();

        return id;
    }

    function transmit() {
        var transaction = binlog[0];
        if (!transaction || transmitting) return;
        transmitting = true;

        pubnub.publish({
            channel  : name
        ,   message  : transaction
        ,   error    : continue_transmissions
        ,   callback : continue_transmissions
        });
    }

    function continue_transmissions(info) {
        transmitting = false;
        var success = info && info[0];

        setTimeout( transmit, success ? 10 : 1000 );
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
        callback : receiver
    };

    fetch_binlog();

    function receiver(messages) {
        var msgs     = messages[0];
        start        = messages[1];
        params.start = start;

        PUBNUB.each( msgs.reverse(), function(m) {binlog.push(m)} );

        callback(binlog);
        progress(msgs);

        if (binlog.length >= limit) return;
        if (msgs.length < count)    return;

        count = 100;
        fetch_binlog();
    }

    function fetch_binlog() { net.history(params) }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Local Merge
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
// Local Storage
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
