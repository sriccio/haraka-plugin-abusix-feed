'use strict'

exports.register = function () {
  this.load_abusix-feed_ini()

  // register hooks here. More info at https://haraka.github.io/core/Plugins/
  // this.register_hook('data_post', 'do_stuff_with_message')
}

exports.load_abusix-feed_ini = function () {
  const plugin = this

  plugin.cfg = plugin.config.get('abusix-feed.ini', {
    booleans: [
      '+enabled',               // plugin.cfg.main.enabled=true
      '-disabled',              // plugin.cfg.main.disabled=false
      '+feature_section.yes'    // plugin.cfg.feature_section.yes=true
    ]
  },
  function () {
    plugin.load_example_ini()
  })
}
