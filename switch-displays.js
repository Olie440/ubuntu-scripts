const { execSync } = require('child_process');

const display_modes = [
    {
        screen: 'HDMI-0',
        sound: {
            card: 'HDA ATI HDMI',
            output: 'hdmi-stereo'
        }
    },
    {
        screen: 'DVI-0',
        sound: {
            card: 'HDA ATI SB',
            output: 'iec958-stereo'
        }
    },
];

const get_screen_config = (function() {
    const display_pattern = /([a-zA-Z]*-\d) connected (?:primary )?(\d{0,4}x\d{0,4})?/
    const raw_config = execSync('xrandr', { encoding: 'utf-8' });

    const parsed_config = raw_config
        .split('\n')
        .filter(line => line.match(display_pattern))
        .map(line => {
            const [full_match, display_name, resolution = null] = line.match(display_pattern);
            return { display_name, resolution };
        });
    
    return function (search) {
        if (search) {
            return parsed_config.find(config => config.display_name === search.screen);
        }

        return parsed_config;
    }

})();

const get_sound_config = (function() {
    const raw_config = execSync('pacmd list-cards', { encoding: 'utf-8' });

    const parsed_config = raw_config
        .split('index')
        .map(output => output.replace(/\t/g, ''))
        .filter(output => output.match(/name: <(.*)>/))
        .map(card => {
            const system_name = card.match(/name: <(.*)>/)[1];
            const display_name = card.match(/alsa\.card_name = "(.*)"/)[1];
            const current_profile = card.match(/active profile: <(.*)>/)[1];

            return { system_name, display_name, current_profile }
        })

    return function(search) {
        if (search) {
            return parsed_config.find(config => config.display_name === search.sound.card);
        }

        return parsed_config
    }

})();

function find_next_config() {
    const current_config = display_modes.findIndex(mode => {
        const screen = get_screen_config(mode)
        const sound_card = get_sound_config(mode)

        return screen.resolution && sound_card.current_profile !== 'off'
    })

    return display_modes[current_config + 1] || display_modes[0];
}

function disable_all_configs() {
    display_modes.forEach(config => {
        const sound_config = get_sound_config(config);

        execSync(`xrandr --output ${config.screen} --off`);
        execSync(`pactl set-card-profile ${sound_config.system_name} off`);
        
    })
}

function switch_config() {
    const next_config = find_next_config();
    const next_sound_config = get_sound_config(next_config);

    disable_all_configs()
    execSync(`xrandr --output ${next_config.screen} --auto`)
    execSync(`pactl set-card-profile ${next_sound_config.system_name} output:${next_config.sound.output}`);
}

switch_config();
