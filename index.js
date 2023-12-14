"use strict";
// Adapted from : https://gitlab.com/abusix-public/abusix_ppd/-/blob/master/index.js

const crypto = require("crypto");
const dgram = require("dgram");

exports.register = function () {
    const plugin = this;

    // Load main plugin config
    plugin.load_config();

    if (!plugin.cfg.feed.name || !plugin.cfg.feed.key) {
        plugin.logerror(`You need to set at least your Abusix feed name and feed key in config/abusix-feed.ini.`);
        return;
    }

    plugin.logdebug(`feed.name: ${plugin.cfg.feed.name}`);
    plugin.logdebug(`feed.key: ${plugin.cfg.feed.key}`);
    plugin.logdebug(`feed.dest: ${plugin.cfg.feed.dest}`);

    // Create UDP socket
    plugin.sock = dgram.createSocket("udp4");

    // Register hook
    plugin.register_hook("mail", "send_feed");
};

exports.load_config = function () {
    // Load plugin configuration
    const plugin = this;

    plugin.cfg = plugin.config.get(
        "abusix-feed.ini",
        {
            booleans: ["+enabled"],
        },
        () => {
            plugin.load_config();
        },
    );

    // Set feed configuration
    if (!plugin.cfg.feed) {
        plugin.cfg.feed = {};
    }

    plugin.cfg.feed.dest = this.cfg.feed.dest || "smtp-rttf.abusix.com:12211";
};

exports.send_feed = function (next, connection, params) {
    const cnx = connection;
    const txn = connection.transaction;
    const plugin = this;

    // Do nothing if no transaction available
    if (!txn) return next();

    // For debug only
    plugin.logdebug(`Params received by send_feed function: ${JSON.stringify(params)}`);

    // Collect stuff we need to send
    const feed_id = plugin.cfg.feed.name;
    const epoch = Date.now();
    const server_port = cnx.local.port || "";
    const helo_name = cnx.hello.host || "unknown";
    const client_address = cnx.remote.ip || "unknown";
    const client_name = cnx.remote.host || cnx.hello.host;
    const sender = params[0].original.indexOf("@") !== -1 ? params[0].host : params[0].original;
    const protocol_name = cnx.hello.verb === "EHLO" ? "Y" : "N";
    const ssl_enabled = cnx.tls.enabled ? "Y" : "N";
    const is_auth = cnx.notes.auth_user ? "Y" : "N";

    // We can let haraka process next hook from here
    next();

    // Create data to send
    const data = [
        feed_id,
        epoch,
        server_port,
        client_address,
        client_name,
        helo_name,
        protocol_name,
        ssl_enabled,
        is_auth,
        sender,
        "",
    ];

    let str = `${data.join("\n").toString()}\n`;
    const digest = crypto
        .createHash("md5")
        .update(str + plugin.cfg.feed.key.trim())
        .digest("hex");
    str += digest;

    plugin.logdebug(`String to send: ${str}`);

    // If multiple feed_dest are supplied, send individually to each
    plugin.cfg.feed.dest.split(/[;, ]+/g).forEach(function (dest) {
        const hp = dest.split(":");
        if (hp && hp[0]) {
            plugin.sock.send(str, hp[1] || 12211, hp[0], function (err) {
                if (err) {
                    plugin.logerror(`UDP socket send error to ${dest}: ${err.message}`);
                } else {
                    plugin.loginfo(`Transaction data sent to: ${dest}`);
                }
            });
        }
    });
};
