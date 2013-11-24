# PubNub DataSync SDK with Boostrap Content Feeder Demo

 - See Demo Live: [Bootstrap Content Feeder](http://stephenlb.github.io/bootstrap-stream-feeder/)
 - Read the Full Docs: [Bootstrap Content Feeder DataSync SDK Documentation](http://stephenlb.github.io/bootstrap-stream-feeder/#datasync-docs)
 - Register For API Keys: [Signup/Login to PubNub Admin Portal](https://admin.pubnub.com/)

```html
<script src="http://cdn.pubnub.com/pubnub.min.js"></script>
<script src="http://cdn.pubnub.com/pubnub-crypto.min.js"></script>
<script src="http://stephenlb.github.io/bootstrap-stream-feeder/dist/js/pubnub-sync.js"></script>
<script>(function(){
    var settings = {
        publish_key   : 'pub-5ad63a7a-0c72-4b86-978d-960dcdb971e1'
    ,   subscribe_key : 'sub-459a5e4a-9de6-11e0-982f-efe715a9b6b8'
    ,   secret_key    : 'sec-fa847381-dcdb-4bcf-a8aa-7b812c390441'
    ,   cipher_key    : 'ODgwNDsmIzczMDustKOiJiM4NzM0O7aqSDNh2mig'
    ,   ssl           : true
    };

    // Connect to DataSync DB
    var db = PUBNUB.sync( 'db-admin', settings );

    // View All Items in DB
    db.all(function(item){       /* -- render all items  -- */ });

    // Register All Callback Events
    db.on.create(function(item){ /* -- new item          -- */ });
    db.on.update(function(item){ /* -- updated item      -- */ });
    db.on.delete(function(item){ /* -- removed item      -- */ });

    // Create Item
    var item = db.create({ headline : "Hello!" });

    // Update Item
    item.update({ headline : "Hello Update!" });

    // Delete Item
    item.delete();
})();</script>
```
