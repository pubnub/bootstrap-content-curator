(function(){

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// SETTINGS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var settings = {
        publish_key   : 'pub-5ad63a7a-0c72-4b86-978d-960dcdb971e1'
    ,   subscribe_key : 'sub-459a5e4a-9de6-11e0-982f-efe715a9b6b8'
    ,   secret_key    : ''
    ,   channel       : 'demo'
};


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// INIT OBJECTS AND ELEMENTS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var pubnub                = PUBNUB.init(settings)
,   push_submit           = pubnub.$('push-submit')
,   new_headline_area     = pubnub.$('new-headline-area')
,   live_posts            = pubnub.$('live-posts')
,   push_text_area        = pubnub.$('push-text-area')
,   published_template    = pubnub.$('published-template').innerHTML
,   publish_edit_template = pubnub.$('publish-edit-template').innerHTML;


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// PUSH SUBMIT ACTION
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.bind( 'mousedown,touchstart', push_submit, submit_headline );
PUBNUB.bind( 'keyup', push_text_area, function(e) {
   if ((e.keyCode || e.charCode) === 13) submit_headline();
} );

function submit_headline() {
    var headline = push_text_area.value;
    if (!headline) return;
    push_text_area.value = '';
    author_action( 'new', {
        id       : PUBNUB.uuid(),
        headline : headline
    } );
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// AUTHOR ACTIONS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function author_action( action, data ) {
    pubnub.publish({
        channel : settings.channel,
        message : {
            action : action,
            data   : data
        }
    });
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// DATA SYNC
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
pubnub.history({
    limit    : 100,
    channel  : settings.channel,
    callback : function(messages) {
        pubnub.each( messages, event_processor );
        pubnub.subscribe({
            backfill : true,
            channel  : settings.channel,
            message  : event_processor
        });
    }
});

function event_processor(message) {
    PUBNUB.events.fire( 'message.' + message.action, message.data );
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// CURATOR RECEIVE HEADLINE FOR PUBLISHING AND EDITING
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.new', function(data) {
    var div = PUBNUB.create('div');
    div.innerHTML = PUBNUB.supplant( publish_edit_template, data );
    new_headline_area.insertBefore( div, first_div(new_headline_area) );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING LIVE POSTS: STREAM FEEDER!
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.publish', function(data) {
    var previous = PUBNUB.$('published-'+data.id);
    if (previous) live_posts.removeChild(previous);
    (function() {
        var div = PUBNUB.create('div');
        div.id = 'published-'+data.id;
        live_posts.insertBefore( div, first_div(live_posts) );
        return div;
    })().innerHTML = PUBNUB.supplant( published_template, data );
} );

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING DELETE
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.delete', function(data) {
    var previous = PUBNUB.$('published-'+data.id);
    if (previous) live_posts.removeChild(previous);
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// EDITOR
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
delegate( PUBNUB.$('new-headline-area'), 'editor' );

// PUBLISH BUTTON CLICK
PUBNUB.events.bind( 'editor.publish', function(event) {
    author_action( 'publish', {
        id       : event.data,
        headline : PUBNUB.$(event.data).innerHTML
    } );
} );

PUBNUB.events.bind( 'editor.delete', function(event) {
    author_action( 'delete', { id : event.data } );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// GET ELEMENT ACTION DATA ATTRIBUTE AND FIRE ASSOCIATED EVENT
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function delegate( element, namespace ) {
    PUBNUB.bind( 'click', element, function(e) {
        var data   = bubblefind( e, 'data-data' )
        ,   action = bubblefind( e, 'data-action' );
        if (!action) return true;
        PUBNUB.events.fire( namespace + '.' + action.result, {
            action : action.result,
            target : action.target,
            data   : data.result
        } );
    } );
}

function bubblefind( e, attr ) {
    var target = e.target || e.srcElement || {}
    ,   result = '';
    while (target) {
        result = PUBNUB.attr( target, attr );
        if (result) return { result : result, target : target };
        target = target.parentNode;
    }
}

function first_div(elm) { return elm.getElementsByTagName('div')[0] }

})();
