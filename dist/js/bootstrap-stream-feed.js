(function(){

// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// SETTINGS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var settings = {
        publish_key   : 'pub-5ad63a7a-0c72-4b86-978d-960dcdb971e1'
    ,   subscribe_key : 'sub-459a5e4a-9de6-11e0-982f-efe715a9b6b8'
    ,   secret_key    : ''
    ,   channel       : 'website6'
};


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// INIT OBJECTS AND ELEMENTS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
var pubnub                  = PUBNUB.init(settings)
,   push_submit             = pubnub.$('push-submit')
,   new_headline_area       = pubnub.$('new-headline-area')
,   live_posts              = pubnub.$('live-posts')
,   push_text_area          = pubnub.$('push-text-area')
,   push_edit_panel         = pubnub.$('push-edit-panel')
,   published_template      = pubnub.$('published-template').innerHTML
,   curator_editor_template = pubnub.$('curator-editor-template').innerHTML
,   publish_edit_template   = pubnub.$('publish-edit-template').innerHTML;



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
    author_action( 'new', 'private', {
        id       : PUBNUB.uuid(),
        headline : headline
    } );
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// AUTHOR ACTIONS
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
function author_action( action, level, data ) {
    console.log( action, level, data )
    pubnub.publish({
        channel : settings.channel + '-' + level,
        message : {
            action : action,
            data   : data
        }
    });
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// DATA SYNC: LIVE - "PUBLIC"
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
pubnub.history({
    limit    : 100,
    channel  : settings.channel + '-private',
    callback : function(messages) {
        pubnub.each( messages[0], event_processor );
        PUBNUB.init(settings).subscribe({
            backfill : true,
            channel  : settings.channel + '-private',
            message  : event_processor
        });
    }
});


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// DATA SYNC: ADMIN - "PRIVATE"
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
pubnub.history({
    limit    : 100,
    channel  : settings.channel + '-public',
    callback : function(messages) {
        pubnub.each( messages[0], event_processor );
        PUBNUB.init(settings).subscribe({
            backfill : true,
            channel  : settings.channel + '-public',
            message  : event_processor
        });
    }
});

function event_processor(message,b,c) {
    PUBNUB.events.fire( 'message.' + message.action, message.data );
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// CURATOR RECEIVE HEADLINE FOR PUBLISHING AND EDITING
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.new', function(data) {
    var previous = PUBNUB.$(data.id);
    if (previous) new_headline_area.removeChild(previous.parentNode);
    (function(){
        var div = PUBNUB.create('div');
        new_headline_area.insertBefore( div, first_div(new_headline_area) );
        return div;
    })().innerHTML = PUBNUB.supplant( publish_edit_template, data );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING LIVE POSTS: STREAM FEEDER!
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.publish', function(data) {
    var previous = PUBNUB.$('published-' + data.id);
    if (previous) live_posts.removeChild(previous.parentNode);
    (function(){
        var div = PUBNUB.create('div');
        live_posts.insertBefore( div, first_div(live_posts) );
        return div;
    })().innerHTML = PUBNUB.supplant( published_template, data );
} );


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// RECEIVING DELETE
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
PUBNUB.events.bind( 'message.delete', delete_public );
PUBNUB.events.bind( 'message.delete-forever', function(data) {
    delete_public(data);
    delete_private(data);
} );
function delete_public(data) {
    var previous = PUBNUB.$('published-'+data.id);
    if (previous) live_posts.removeChild(previous.parentNode);
}
function delete_private(data) {
    var previous = PUBNUB.$(data.id);
    if (previous) new_headline_area.removeChild(previous.parentNode);
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
// EDITOR
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
delegate( PUBNUB.$('new-headline-area'), 'editor' );
delegate( PUBNUB.$('push-edit-panel'),   'editor' );

// PUBLISH
PUBNUB.events.bind( 'editor.publish', function(event) {
    author_action( 'publish', 'public', {
        id       : event.data,
        headline : PUBNUB.$(event.data).innerHTML
    } );
} );

// HIDE
PUBNUB.events.bind( 'editor.hide', function(event) {
    author_action( 'delete', 'public', { id : event.data } );
} );

// FOREVER DELETE
PUBNUB.events.bind( 'editor.delete', function(event) {
    author_action( 'delete',         'public',  { id : event.data } );
    author_action( 'delete-forever', 'private', { id : event.data } );
} );

// EDITOR SHOW
PUBNUB.events.bind( 'editor.edit', function(event) {
    push_edit_panel.innerHTML = PUBNUB.supplant(
        curator_editor_template,
        { id : event.data }
    );
    PUBNUB.css( push_edit_panel, { display : 'block' } );
    var push_text_edit   = pubnub.$('push-text-edit-area');
    push_text_edit.value = PUBNUB.$(event.data).innerHTML;
    push_text_edit.focus();
} );

// EDITOR SAVE
PUBNUB.events.bind( 'editor.save', function(event) {
    PUBNUB.css( push_edit_panel, { display : 'none' } );

    author_action( 'new', 'private', {
        id       : event.data,
        headline : PUBNUB.$('push-text-edit-area').value
    } );
} );

// EDITOR CANCEL
PUBNUB.events.bind( 'editor.cancel', function(event) {
    PUBNUB.css( push_edit_panel, { display : 'none' } );
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
