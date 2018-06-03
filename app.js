var restify = require('restify');
var builder = require('botbuilder');
var underscore = require('underscore');

var usersData = require('./users.json');

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

server.post('/api/messages', connector.listen());

var bot = new builder.UniversalBot(connector, function (session) {
    session.send('No entiendo a qué te refieres con "%s". Escribe "Ayuda" para obtener información acerca de qué puedo hacer.', session.message.text);
});

bot.recognizer({
    recognize: function (context, done) {
    var intent = { score: 0.0 };
  
          if (context.message.text) {
                switch (context.message.text.toLowerCase()) {
                    case 'hola':
                        intent = { score: 1.0, intent: 'Saludo' };
                        break;
                    case 'ayuda':
                        intent = { score: 1.0, intent: 'Ayuda' };
                        break;
                    case 'adios':
                        intent = { score: 1.0, intent: 'Adios' };
                        break;
              }
          }
          done(null, intent);
      }
  });

bot.dialog('Saludar', function(session){
    session.endDialog('Hola, ¿en qué puedo ayudarte? Escribe "Ayuda" para obtener información acerca de qué puedo hacer.');
}).triggerAction({ matches: 'Saludo'});

bot.endConversationAction('Despedirse', 'Fue un gusto ayudarte. ¡Hasta luego!', { matches: 'Adios'});

bot.dialog('Ayudar', function(session, args){
    if(args && args.algoMas){
        session.endDialog("¿Puedo ayudarlo en algo más?");
    }else{
        session.endDialog('Para buscar una persona escribe "Quien es", "Quien trabaja en" mas el término de busqueda');
    }
}).triggerAction({ matches: 'Ayuda'});

bot.recognizer(new builder.RegExpRecognizer('BusquedaPersonaPorNombre', /^(¿)*Quien( es)*/i));
bot.dialog('BuscandoPersonaPorNombre', function(session){
    let nombre = session.message.text.replace(new RegExp("^(¿)*Quien( es)* ", "i"), '').replace('?', '');
    let usuarios = buscarPersonaPorNombre(nombre);
    if(usuarios.length == 0){
        session.endDialog('No se encontraron resutados relacionados con "%s"', nombre);
    } else {
        session.conversationData.usuarios = usuarios;
        session.conversationData.indiceUsuario = 0;
        session.beginDialog('MostrarResultadosBusquedaPersona');
    }
}).triggerAction({ matches: 'BusquedaPersonaPorNombre' });

bot.recognizer(new builder.RegExpRecognizer('BusquedaPersonaPorEmpresa', /^(¿)*Quien trabaja( en)*/i));
bot.dialog('BuscandoPersonaPorEmpresa', function(session){
    let empresa = session.message.text.replace(new RegExp("^(¿)*Quien trabaja( en)* ", "i"), '').replace('?', '');
    let usuarios = buscarPersonaPorEmpresa(empresa);
    if(usuarios.length == 0){
        session.endDialog('No se encontraron resutados de personas que trabajen en "%s"', empresa);
    } else {
        session.conversationData.usuarios = usuarios;
        session.conversationData.indiceUsuario = 0;
        session.beginDialog('MostrarResultadosBusquedaPersona');
    }
}).triggerAction({ matches: 'BusquedaPersonaPorEmpresa' });

bot.dialog('MostrarResultadosBusquedaPersona', [
    function(session, args){
        let usuario = session.conversationData.usuarios[session.conversationData.indiceUsuario++];

        if(args && args.verTodo){
            while(session.conversationData.indiceUsuario <= session.conversationData.usuarios.length){
                session.send('%s %s tiene %s años, trabaja en %s como %s y su correo electrónico es %s',
                    usuario.name.first, usuario.name.last, usuario.age, usuario.company, usuario.companyRole, usuario.email);

                usuario = session.conversationData.usuarios[session.conversationData.indiceUsuario++];
            }
        }else{
            session.send('%s %s tiene %s años, trabaja en %s como %s y su correo electrónico es %s',
                usuario.name.first, usuario.name.last, usuario.age, usuario.company, usuario.companyRole, usuario.email);
        }

        if(session.conversationData.usuarios.length > session.conversationData.indiceUsuario + 1){
            let mensaje = "¿Desea ver la información de la siguiente persona?";
            if(session.conversationData.indiceUsuario == 1){
                mensaje = `Se encontraron ${session.conversationData.usuarios.length - 1} persona más, ` + mensaje;
            }
            builder.Prompts.choice(session, mensaje, "Si|No|Ver todo", { listStyle: 1 });            
        }else{
            session.replaceDialog('Ayudar', { algoMas: true });
        }
    },
    function(session, results){
        if(results.response.entity.toLowerCase() == "si"){
            session.replaceDialog('MostrarResultadosBusquedaPersona');
        }else if(results.response.entity.toLowerCase() == "ver todo"){
            session.replaceDialog('MostrarResultadosBusquedaPersona', { verTodo: true });
        }else{
            session.replaceDialog('Ayudar', { algoMas: true });
        }
    }
]);

function buscarPersonaPorNombre(text){
    let regularExpression = new RegExp(text, 'i');
    let usuarios = underscore.filter(usersData, function(user){
        return (regularExpression.test(user.name.first + ' ' + user.name.last));
    });
    return usuarios;
}

function buscarPersonaPorEmpresa(text){
    let regularExpression = new RegExp(text, 'i');
    let usuarios = underscore.filter(usersData, function(user){
        return (regularExpression.test(user.company));
    });
    return usuarios;
}