import csv
import json


class Utils:
    @staticmethod
    def save_json_file(filename, content):
        with open(filename, 'w', encoding='utf8') as outfile:
            json.dump(content, outfile, sort_keys=True, indent=4, ensure_ascii=False)  # sort_keys = True, indent = 4

    @staticmethod
    def read_json_file(filename):
        file = open(filename, 'r')
        return json.load(file)

    @staticmethod
    def save_file(filename, content):
        with open(filename, 'w', encoding='utf8') as outfile:
            outfile.write(content)

    @staticmethod
    def read_file(filename):
        file = open(filename, 'r')
        return file.read()

    @staticmethod
    def save_csv_file(filename, data):
        with open(filename, mode='w') as file:
            writer = csv.writer(file, delimiter=';')
            writer.writerows(data)

    @staticmethod
    def delete_duplicates(items):
        i = 1
        while i < len(items):
            if items[i]['id'] == items[i - 1]['id']:
                items.pop(i)
                i -= 1
            i += 1
