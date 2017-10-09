#!/usr/bin/env ruby

require 'colorize'
require 'sxp'

def fmt_time(seconds)
  h = seconds / 3600
  m = (seconds % 3600) / 60
  s = seconds % 60
  return "%02d:%02d:%02d" % [h,m,s]
end

def load_ranking
  SXP::Reader::CommonLisp.read(File.read("ranking.lisp"))
rescue Errno::ENOENT
  []
end

def show_ranking
  attrlist = load_ranking
  attrlist.each.with_index(1) do |(name, time), i|
    puts "%d. %s\t%s" % [i, name, fmt_time(time)]
  end
  puts
end

def puts_huge(str)
  puts "\e\#3#{str}"
  puts "\e\#4#{str}"
end

def show_banner
  system("clear")
  puts
  puts
  puts
  puts_huge(" "*13 + "\u{2694} " +
            "もげ ".bold +
            "R".red +
            "P".red +
            "G".red +
            " \u{1f6e1}")
  puts
  puts
end

def show_choices
  puts "1. START"
  puts "2. SHOW RANKING"
  puts "3. EXIT"
end

show_banner
show_choices

loop do
  number = nil

  until number
    print "#? "

    input = gets
    if input.nil?
      number = 3
    elsif input =~ /^\d+$/
      number = input.to_i
    end
  end

  case number
  when 1
    system("./mogerpg.exe")
    puts
    show_choices
  when 2
    show_ranking
  when 3
    puts
    puts("Bye!")
    break
  else
    puts('what?')
  end
end
